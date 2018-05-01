// @flow

import fetchMock from 'fetch-mock';
import { sha256 } from 'js-sha256';
import { RelayNetworkLayer } from 'react-relay-network-modern';

import persistedQueries from '../index';

const successResponse = {
  data: {
    getUser: {
      id: 'VXNlcjo=',
      name: 'Joe',
      surname: 'Doe',
    },
  },
};

const queryNotFound = {
  data: null,
  errors: [{ message: 'PersistedQueryNotFound' }],
};

const operation = {
  kind: 'Batch',
  fragment: {},
  metadata: {},
  text: 'query AppQuery {\n  getUser {\n    name\n    surname\n    id\n  }\n}\n',
  name: 'SampleQuery',
  operationKind: 'query',
  id: '3b569978eefa6cb3241ee5b5abd4ed861d8625030cb91cbcdb0272412aed7b47', // sha256
};

describe('persisted queries middleware', () => {
  beforeEach(() => {
    fetchMock.restore();
  });

  it('returns data for persisted query with id', async () => {
    fetchMock.postOnce({
      matcher: '/graphql',
      response: {
        status: 200,
        body: successResponse,
      },
    });

    const network = new RelayNetworkLayer([persistedQueries()]);
    await network.fetchFn(operation, {});
    const requestBody = JSON.parse(fetchMock.lastCall('/graphql')[1].body);

    expect(fetchMock.calls('/graphql')).toHaveLength(1);
    expect(requestBody).toEqual({
      operationName: 'SampleQuery',
      variables: {},
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: operation.id,
        },
      },
    });
  });

  it('negotiates new persisted query', async () => {
    fetchMock.post({
      name: 'notFound',
      matcher: '/graphql',
      response: {
        status: 200,
        body: queryNotFound,
      },
      repeat: 1,
    });
    fetchMock.post({
      name: 'negotiation',
      matcher: '/graphql',
      response: {
        status: 200,
        body: successResponse,
      },
      repeat: 1,
    });

    const network = new RelayNetworkLayer([persistedQueries()]);
    await network.fetchFn(operation, {});
    const requestBody = JSON.parse(fetchMock.lastCall('negotiation')[1].body);

    expect(fetchMock.calls('/graphql')).toHaveLength(2);
    expect(requestBody).toEqual({
      operationName: 'SampleQuery',
      query: 'query AppQuery {\n  getUser {\n    name\n    surname\n    id\n  }\n}\n',
      variables: {},
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: operation.id,
        },
      },
    });
  });

  it('supports GET with persisted query', async () => {
    fetchMock.getOnce({
      name: 'withGet',
      matcher:
        'http://localhost/graphql?operationName=SampleQuery&variables=%7B%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%223b569978eefa6cb3241ee5b5abd4ed861d8625030cb91cbcdb0272412aed7b47%22%7D%7D',
      response: {
        status: 200,
        body: successResponse,
      },
    });

    const network = new RelayNetworkLayer([persistedQueries({ useGETForHashedQueries: true })]);
    await network.fetchFn(operation, {});

    expect(fetchMock.calls('withGet')).toHaveLength(1);
  });

  it('query can be hashed on demand', async () => {
    fetchMock.postOnce({
      matcher: '/graphql',
      response: {
        status: 200,
        body: successResponse,
      },
    });

    const operationWithoutId = { ...operation, id: null };

    const network = new RelayNetworkLayer([persistedQueries({ hash: sha256 })]);
    await network.fetchFn(operationWithoutId, {});
    const requestBody = JSON.parse(fetchMock.lastCall('/graphql')[1].body);

    expect(fetchMock.calls('/graphql')).toHaveLength(1);
    expect(requestBody).toEqual({
      operationName: 'SampleQuery',
      variables: {},
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: operation.id,
        },
      },
    });
  });

  it('hash function must be provided if query has no id', () => {
    const operationWithoutId = { ...operation, id: null };

    const network = new RelayNetworkLayer([persistedQueries()]);
    return expect(network.fetchFn(operationWithoutId, {})).rejects.toThrow(
      'Either query id or hashing function & query must be defined!',
    );
  });

  it('returns error when persisted query not supported', () => {
    fetchMock.postOnce({
      matcher: '/graphql',
      response: {
        status: 200,
        body: {
          data: null,
          errors: [{ message: 'PersistedQueryNotSupported' }],
        },
      },
    });

    const network = new RelayNetworkLayer([persistedQueries()]);
    return expect(network.fetchFn(operation, {})).rejects.toThrow('PersistedQueryNotSupported');
  });

  it('fails with regular GraphQL error', () => {
    const partialError = {
      data: {
        getUser: {
          ...successResponse.data.getUser,
          surname: null,
        },
      },
      errors: [
        {
          locations: [
            {
              column: 15,
              line: 1,
            },
          ],
          message: 'Something went wrong.',
          path: ['getUser', 'surname'],
        },
      ],
    };
    fetchMock.postOnce({
      matcher: '/graphql',
      response: {
        status: 200,
        body: partialError,
      },
    });

    const network = new RelayNetworkLayer([persistedQueries()]);
    return expect(network.fetchFn(operation, {})).rejects.toThrow('Something went wrong');
  });
});
