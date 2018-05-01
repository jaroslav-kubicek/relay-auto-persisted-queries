// @flow

import { RelayNetworkLayerRequestBatch } from 'react-relay-network-modern';

type Options = {
  useGETForHashedQueries?: boolean,
  hash?: (?string) => string,
};

const createGETUrl = (fetchUrl, persistedQuery) => {
  // eslint-disable-next-line no-undef
  const base = typeof window === 'object' ? window.location.origin : '';
  const url = new URL(fetchUrl || '/graphql', base);
  Object.entries(persistedQuery).forEach(([key, value]) => {
    const param = typeof value === 'object' ? JSON.stringify(value) : String(value);

    url.searchParams.append(key, param);
  });

  return url.toString();
};

const persistedQueries = (options: Options = {}) => (next: Function) => async (req: Object) => {
  if (req instanceof RelayNetworkLayerRequestBatch) {
    throw new Error('Batched requests are not supported by current version.');
  }

  const { id: queryId, text: queryText } = req.operation;

  if (!queryId && (!options.hash || !queryText)) {
    throw new Error('Either query id or hashing function & query must be defined!');
  }

  const persistedQuery = {
    operationName: req.operation.name,
    variables: req.variables,
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: queryId || (options.hash && options.hash(queryText)),
      },
    },
  };
  const originalMethod = req.fetchOpts.method;
  // if requested, use GET for queries (but not mutations)
  if (options.useGETForHashedQueries && req.operation.operationKind === 'query') {
    req.fetchOpts.method = 'GET';
    delete req.fetchOpts.body;
    req.fetchOpts.url = createGETUrl(req.fetchOpts.url, persistedQuery);
  } else {
    req.fetchOpts.body = JSON.stringify(persistedQuery);
  }

  const res = await next(req);

  if (res.errors && res.errors.length === 1) {
    if (res.errors[0].message === 'PersistedQueryNotSupported') {
      return res;
    }

    if (res.errors[0].message === 'PersistedQueryNotFound') {
      req.fetchOpts.method = originalMethod;
      req.fetchOpts.body = JSON.stringify(Object.assign({}, persistedQuery, { query: queryText }));

      return next(req);
    }
  }

  return res;
};

export default persistedQueries;
