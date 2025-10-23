// Local augmentation to ensure Express.Request has id in this package build
declare namespace Express {
  interface Request {
    id: string;
  }
}
