"use strict";

const ChainRejection = (Location) => { return Promise.reject(Location) }

const Assert = expression => { if (!(expression)) { console.error("Assertion Failed"); debugger; } }
const InvalidCodePath = () => { Assert(false); }

// This is used to directly look up into Router.routes so it CANNOT have a leading slash
const ROUTE_404     = "404";

const ROUTE_INTRO   = "/intro";
const ROUTE_VIM_CREDITS = "/vim/credits";
const ROUTE_VIM_INDEX = "/vim/index";

const INTRO_ANIM_COMPLETE = "IntroAnimationComplete"
const INDEX_ANIM_COMPLETE = "IndexAnimationComplete"

const FUNC_INIT = "Init";
const FUNC_MAIN = "Main";

function AnimationStatus() {
  this.cancelled = false;
}

function MakeRoute(DomRef) {
  Assert(DomRef instanceof HTMLElement);

  this.Name = DomRef.dataset.route;

  this.InitialDom = DomRef.cloneNode(true);

  this.Main = null;
  this.Callbacks = null;
  this.AnimationStatus = new AnimationStatus();
}

function AppState() {
  this.Router = null;
}

function TypedElement(Dom) {
  Assert(Dom instanceof HTMLElement);

  const Content = Dom.innerHTML.split("");
  Dom.innerHTML = "";

  this.Content = Content;
  this.Dom = Dom;
}

const PageLoaded = () => {
  const Result = document.readyState === 'complete';
  return Result;
}

const WaitTillLoaded = setInterval( () => {
  if ( PageLoaded() ) {
    clearInterval(WaitTillLoaded);
    Init().then ( (State) => Main(State) );
  }
}, 5);

const wait = (ms, Route) => {
  Assert(Route instanceof MakeRoute);

  return new Promise( (resolve, reject) => {
    if (Route.AnimationStatus.cancelled) reject("Wait")
    else setTimeout( () => { resolve(); }, ms)
  });
}

const SetVisibility = (element, vis) => {
  Assert(element instanceof HTMLElement);
  element.style.visibility = vis;
}

const ToggleDisplay = (element, d1, d2) => {
  Assert(element instanceof HTMLElement);
  const display = window.getComputedStyle(element).display;

  if (display === d1) {
    element.style.display = d2;

  } else if (display === d2) {
    element.style.display = d1;

  } else { InvalidCodePath() }
}

const SetDisplay = (element, display) => {
  Assert(element instanceof HTMLElement);
  element.style.display = display;
}

const typeText = (Elem, Route, finalDelay = 500) => {
  Assert(Elem instanceof TypedElement);
  Assert(Route instanceof MakeRoute);
  Assert(Route.AnimationStatus instanceof AnimationStatus);

  const charAnimInterval = 50;

  PurgeCursors(document.body);
  Elem.Dom.classList.add("typing-active");

  return new Promise( (resolve, reject) => {

    // Copy so we can re-use Elem.Content if we re-navigate through this route
    const text = Array.from(Elem.Content);

    const TextAnimation = setInterval( () => {

      if (Route.AnimationStatus.cancelled) {
        clearInterval(TextAnimation);
        reject( "typeText " + Elem.Content.join(""));
        return;
      }

      if (text.length == 0) {
        clearInterval(TextAnimation);

        setTimeout(() => {
          resolve();
        },
        finalDelay );

        return;
      }

      Elem.Dom.innerHTML += text.shift();
    }, charAnimInterval );

  });
}

const SetHeight = (Dom, Bounds) => {
  Assert(Dom instanceof HTMLElement);
  Dom.style.height = Bounds.bottom - Bounds.top;;
}

let Global_State = new AppState();
let Global_bindUserCallbackData = { State: Global_State, pendingUserCallbacks: 0 };

const UserCallback = callback => {
  ++Global_bindUserCallbackData.pendingUserCallbacks;

  document.addEventListener( USER_CALLBACKS_START, (Event) => {
    --Global_bindUserCallbackData.pendingUserCallbacks;
    callback(Event.detail.State);
  });
}

const BindRouteCallback = (RouteName, callback, FuncName) => {
  Assert(typeof RouteName === "string");
  Assert(typeof callback === "function");
  Assert(FuncName === FUNC_INIT || FuncName === FUNC_MAIN);

  UserCallback( (State) => {
    console.log(`Binding ${RouteName} ${FuncName}`);

    const Route = LookupRoute(State.Router, RouteName);
    Assert(Route instanceof MakeRoute);
    Route[FuncName] = callback.bind(null, State, Route);
  });
}

const InitCallback = (RouteName, callback) => {
  BindRouteCallback(RouteName, callback, FUNC_INIT);
}

const MainCallback = (RouteName, callback) => {
  BindRouteCallback(RouteName, callback, FUNC_MAIN);
}

const Render = (RoutePath, Router) => {
  Assert(Router instanceof MakeRouter);
  console.log(" -- Render");

  const Dom = document.createElement("div");

  const Path = RoutePath.split('/');
  Assert(Path[0] === "");
  Path.shift();

  let Table = Router.routes;
  for ( let PathIndex = 0;
        PathIndex < Path.length;
        ++PathIndex )
  {
    const PathSeg = Path[PathIndex];
    const RenderRoute = Table[PathSeg];

    if (RenderRoute) {
      Table = RenderRoute;

      const Yield = Dom.getElementsByClassName("yield")[0];
      if (Yield) {
        // TODO(Jesse): Is cloning necessary here?
        Yield.outerHTML = RenderRoute.InitialDom.cloneNode(true).outerHTML;
      } else {
        Dom.appendChild(RenderRoute.InitialDom.cloneNode(true));
      }
    }
  }

  document.body.innerHTML = Dom.innerHTML;
}


// TODO(Jesse): Polyfill CustomEvent for <IE9 ?
const BindUserCallbacks = (State) => {

  return new Promise( (resolve) => {

    const event = new CustomEvent(USER_CALLBACKS_START, {detail: Global_bindUserCallbackData});
    document.dispatchEvent(event);

    const WaitForUserCallbacks = setInterval( () => {
      if (Global_bindUserCallbackData.pendingUserCallbacks === 0) {
        clearInterval(WaitForUserCallbacks);
        resolve();
      }
    }, 25);

  });
}

const Init = () => {
  return new Promise ( (resolve) => {
    const State = Global_State;

    const Dom = document.createElement("div");
    document.body.appendChild(Dom);

    Global_State.Dom = Dom;

    State.Router = new MakeRouter(ROUTE_VIM_INDEX);

    console.log("Start: BindUserCallbacks");
    BindUserCallbacks(State).then( () => {
      console.log("Finish: Bind User Callbacks");
      const event = new CustomEvent(USER_CALLBACKS_COMPLETE, {detail: State});
      document.dispatchEvent(event);
    });

    resolve(State);
  });
}

const SetCookie = (Cookie) => {
  document.cookie = `${Cookie.name}=${Cookie.value};`
}

const ReadCookie  = (Needle) => {
  let Result = false;

  document.cookie.split(";").forEach( (cookie) => {
    var eqPos = cookie.indexOf("=");
    var Name = cookie.substr(0, eqPos).trim();
    if (Name === Needle) {
      Result = cookie.substr(eqPos+1, cookie.length);
    }
  });

  switch (Result) {
    case "true":
      Result = true;
    break;

    case "false":
      Result = false;
    break;
  }

  return Result;
}

const ClearAllCookies = () => {
  document.cookie.split(";").forEach( (cookie) => {
    var eqPos = cookie.indexOf("=");
    var name = cookie.substr(0, eqPos).trim();
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  });
}

const Main = (State) => {
  Assert(State instanceof AppState);

  const Router = State.Router;
  Assert(Router instanceof MakeRouter);

  SetDisplay(document.body, DISPLAY_BLOCK);

  const IntroComplete = ReadCookie(INTRO_ANIM_COMPLETE);
  if (IntroComplete === false) {
    Router.navigate(ROUTE_INTRO);
  }

}
