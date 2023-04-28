class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class BodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BodyError";
  }
}

class ParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParameterError";
  }
}

export {
  ValidationError,
  AuthenticationError,
  BodyError,
  ParameterError
}
