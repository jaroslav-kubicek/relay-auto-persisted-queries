# Automatic persisted queries (APQ) for Relay modern

## Idea

The goal is to bring APQ functionality provided by [APQ negotiation protocol](https://github.com/apollographql/apollo-link-persisted-queries) from Apollo world to Relay Modern and enable using persisted queries between Relay client and server that either uses Apollo Engine directly or implements the same protocol.

## Install

`yarn add relay-runtime react-relay-network-modern relay-auto-persisted-queries`

## Use

This is complete working setup of Relay Modern environment:

```javascript
// @flow

import { sha256 } from 'js-sha256';
import persistedQueries from 'relay-auto-persisted-queries';
import { Environment, RecordSource, Store } from 'relay-runtime';
import {
  RelayNetworkLayer,
  urlMiddleware,
} from 'react-relay-network-modern';

const network = new RelayNetworkLayer([
  urlMiddleware({
    url: () =>
      Promise.resolve('https://yourserver.example.com/graphql')
  }),
  persistedQueries({ useGETForHashedQueries: true, hash: sha256 })
]);

const source = new RecordSource();
const store = new Store(source);
export default new Environment({ network, store });
```

Note you can start using `GET` for queries since the payload sent to the server with persistent query is always small.

## Resources

- [APQ negotiation protocol](https://github.com/apollographql/apollo-link-persisted-queries#protocol)
- [GraphQL pitfalls](https://code.kiwi.com/graphql-pitfalls-b5f38812fd29)
- [Improve GraphQL Performance with Automatic Persisted Queries](https://dev-blog.apollodata.com/improve-graphql-performance-with-automatic-persisted-queries-c31d27b8e6ea?_ga=2.109587714.64809478.1524949703-2080548610.1520632449)
- [Caching GraphQL results in your CDN](https://dev-blog.apollodata.com/caching-graphql-results-in-your-cdn-54299832b8e2)
- [Apollo Engine DOCs for APQ](https://www.apollographql.com/docs/engine/auto-persisted-queries.html)
