export const sitePath = (path: string) =>
  path.startsWith('/')
    ? `${process.env.__NEXT_ROUTER_BASEPATH ?? ''}${path}`
    : path;
