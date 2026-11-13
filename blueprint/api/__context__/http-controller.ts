import {UnauthorizedError} from "@lib/error/unauthorized-error";
import {ValidationError} from "@lib/error/validation-error";
import {NotFoundError} from "@lib/error/not-found-error";

export default async function (req: Request): Promise<Response> {
  try {
    /**
     * Organize request handling with your favorite framework
     *
     * 1. Authorize request
     * 2. Validate request
     * 3. Map request to command or query
     * 4. Execute command or query through the domain module
     * 5. Return response
     *
     * @todo: Discuss request handling
     *
     * --------------------------------------------------------
     * auth(req);
     * validate(req);
     * const command = mapRequestToCommand(req);
     * await domainContext.handle(command);
     * res.json({success: true});
     * --------------------------------------------------------
     * auth(req);
     * validate(req);
     * const query = mapRequestToQuery(req);
     * const result = await domainContext.resolve(query);
     * res.json(result);
     */

    return Response.json({success: true});
  } catch (e) {
    if(e instanceof UnauthorizedError) {
      return Response.json({error: 'Unauthorized'}, {status: 401});
    }

    if(e instanceof ValidationError) {
      return Response.json({error: 'Validation failed'}, {status: 400});
    }

    if(e instanceof NotFoundError) {
      return Response.json({error: 'Not found'}, {status: 404});
    }

    console.error(e);
    return Response.json({error: 'Internal server error'}, {status: 500});
  }

}
