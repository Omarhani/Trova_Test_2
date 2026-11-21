import { AppApi } from '../client/appApi';

/**
 * Parent of every API service (one service per area of the app: its endpoints and bodies). It rides on a signed-in
 * client - the run's one sign-in of that login - and never signs in, decides the scenario or checks the result.
 */
export abstract class BaseService {
  constructor(protected readonly api: AppApi) {}
}
