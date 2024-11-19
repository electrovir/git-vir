export class LoggedError extends Error {
    public override readonly name = 'LoggedError';
    constructor() {
        super();
    }
}
