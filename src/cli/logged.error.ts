export class LoggedError extends Error {
    public override readonly name = 'LoggedError';
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor() {
        super();
    }
}
