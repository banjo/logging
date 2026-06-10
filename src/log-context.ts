import { AsyncLocalStorage } from "node:async_hooks";

import type { LogContext, LogContextApi, LogFields } from "./types.ts";

type Store<TWideEventFields extends LogContext = LogContext> = {
  context: LogFields<TWideEventFields>;
};

export const createLogContext = <
  TWideEventFields extends LogContext = LogContext,
>(): LogContextApi<TWideEventFields> => {
  const storage = new AsyncLocalStorage<Store<TWideEventFields>>();

  const run = <T>(context: LogFields<TWideEventFields>, fn: () => T): T => {
    return storage.run({ context }, fn);
  };

  const get = (): LogFields<TWideEventFields> => {
    return storage.getStore()?.context ?? {};
  };

  const addContext = (fields: LogFields<TWideEventFields>): void => {
    const store = storage.getStore();
    if (!store) {
      return;
    }
    Object.assign(store.context, fields);
  };

  return { run, get, addContext };
};
