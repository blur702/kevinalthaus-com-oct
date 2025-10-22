// Local augmentation to ensure Express.Request has id in this package build
declare namespace Express {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Request {
    id: string;
  }
}

