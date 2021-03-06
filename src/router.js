function LookupRoute(Router, RouteNameOrUrl)
{
  Assert(Router instanceof MakeRouter);
  Assert(typeof RouteNameOrUrl === "string");

  let RouteName = RouteNameOrUrl;
  if (RouteNameOrUrl[0] === "/") {
    RouteName = RouteNameOrUrl.substring(1);
  }

  let ResolvedRoute = Router.ResolveRootUrlAlias(RouteName);
  let Path = ResolvedRoute.split("/");

  let Result = null;
  let Table = Router.routes;
  for ( let PathIndex = 0;
        PathIndex < Path.length;
        ++PathIndex )
  {
    let PathSeg = Path[PathIndex];
    Result = Table[PathSeg];

    if (Result) {
      Table = Result;
      continue;
    } else {
      Result = Router.routes[ROUTE_404];
      break;
    }
  }

  Assert(Result);

  return Result;
}

document.addEventListener( USER_CALLBACKS_COMPLETE, (Event) => {
  // Replace the navigate function once the framework is loaded and perform
  // all pending navigations.
  console.log("overriding router.navigate");

  const State = Event.detail;
  const Router = State.Router;
  const PushState = Router.routingMode === RoutingMode_PushState;

  Router.navigate = (url) => {
    if (this.Current) {
      this.Current.AnimationStatus.cancelled = true;
      if (PushState) history.pushState({}, "", this.Current.Name);
    }

    const UrlRootResolved = Router.ResolveRootUrlAlias(url);
    const TargetRoute = LookupRoute(Router, UrlRootResolved)
    Assert(TargetRoute);
    Assert(TargetRoute.AnimationStatus instanceof AnimationStatus);

    if (TargetRoute.Name === "/404")
      Router.UpdateBrowserUrl("/404");
    else
      Router.UpdateBrowserUrl(url);

    if (this.Current)
      console.log("Navigating from %s to %s", this.Current.Name, TargetRoute.Name);

    this.Current = TargetRoute;

    TargetRoute.AnimationStatus.cancelled = false;
    // It's important to render the route initially before firing the Routes
    // Main() because then the route can query the rendered Dom

    Render(TargetRoute.Name, Router);

    if (TargetRoute.Init) {
      console.log(TargetRoute.Name, " Running Init");
      TargetRoute.Init(State, TargetRoute);
    }

    if (TargetRoute.Main) {
        console.log(TargetRoute.Name, " Running Main");
        TargetRoute.Main(State);
    }

  }


  Router.pendingNavigations.forEach( (Nav) => {
    Router.navigate(Nav);
  });

  delete Router.pendingNavigations;
});

function MakeRouter(Root) {

  /* Data Properties
   * **********************************************************************/

  // Before the framework is initialized, Router.navigate pushes stuff into
  // this array.  Once the framework loads it is flushed and deleted.
  this.pendingNavigations = [];

  this.root = Root;

  this.Current = null;
  this.routingMode = RoutingMode_Undefined;

  this.routes = {};

  /* Namespaced Functions
   * **********************************************************************/

  this.ResolveRootUrlAlias = function(Route) {
    let Lookup = Route;
    if (Lookup === "/") Lookup = this.root;
    return Lookup;
  }

  this.UpdateBrowserUrl = (url) => {
    if (this.routingMode === RoutingMode_PushState)
      history.replaceState({}, "", `${url}`);
    else
    {
      // FIXME(Jesse): for some reason OnNavEvent still fires when we take this
      // path so we end up navigating twice when calling Router.navigate
      // document.body.onhashchange = null;
      document.location.hash = `${url}`;
      // document.body.onhashchange = this.OnNavEvent;
    }
    return;
  }

  this.PullUrlFromDocument = () => {
    if ( this.routingMode === RoutingMode_Hash &&
         document.location.hash.length > 0)
    {
      let Hash = document.location.hash;
      if (Hash.length > 0) {
        Assert(Hash[0] === '#');
        Route = Hash.substring(1);
      }
    }
    else if ( this.routingMode === RoutingMode_PushState &&
              document.location.pathname.length > 0)
    {
      Route = document.location.pathname;
    }
    else
    {
      Route = "/";
    }

    return Route;
  }

  // Stub method to cache navigations before the framework is fully loaded
  this.navigate = function(targetRoute) {
    console.log("Caching nav to ", targetRoute);
    this.pendingNavigations.push(targetRoute);
  }

  this.OnNavEvent = (e) => {
    let url = this.PullUrlFromDocument();
    this.navigate(url);
  }


  /* Initialization
   * **********************************************************************/
  {
    console.log("Router.Initialize");

    if ( history.pushState && document.location.protocol != "file:") {
      this.routingMode = RoutingMode_PushState;
      document.body.onpopstate = this.OnNavEvent;
    } else {
      this.routingMode = RoutingMode_Hash;
      // document.body.onhashchange = this.OnNavEvent;
    }

    // Init Route Dom objects
    let DomElements = Array.from(document.getElementsByClassName("route"));
    let RouteElements = DomElements.map( (Dom) => {

      let Route = new MakeRoute(Dom);
      SetDisplay(Route.InitialDom, DISPLAY_BLOCK);

      let RoutePath = Dom.dataset.route.split("/");
      // Routes must begin with a / therefore the first element must be ""
      Assert(RoutePath[0] === "");
      Assert(RoutePath.length > 1);
      RoutePath.shift();

      let RoutePathRoot = RoutePath[0];

      let RouteTreeRef = this.routes;

      for ( let PathIndex = 0; PathIndex < RoutePath.length; ++ PathIndex )
      {
        let PathSeg = RoutePath[PathIndex];

        if ( PathIndex === RoutePath.length-1 )
          RouteTreeRef[PathSeg] = Route;

        else if (!RouteTreeRef[PathSeg])
          RouteTreeRef[PathSeg] = {}

        else
          RouteTreeRef = RouteTreeRef[PathSeg]
      }

    });

    this.OnNavEvent();
  }
}
