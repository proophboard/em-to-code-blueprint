export default async function (req: Request, res: Response) {
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
}
