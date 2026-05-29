import x, { createElement as er } from "react";
var R = function() {
  return R = Object.assign || function(t) {
    for (var r, n = 1, s = arguments.length; n < s; n++) {
      r = arguments[n];
      for (var o in r) Object.prototype.hasOwnProperty.call(r, o) && (t[o] = r[o]);
    }
    return t;
  }, R.apply(this, arguments);
};
function oe(e, t, r) {
  if (r || arguments.length === 2) for (var n = 0, s = t.length, o; n < s; n++)
    (o || !(n in t)) && (o || (o = Array.prototype.slice.call(t, 0, n)), o[n] = t[n]);
  return e.concat(o || Array.prototype.slice.call(t));
}
var tr = {
  animationIterationCount: 1,
  aspectRatio: 1,
  borderImageOutset: 1,
  borderImageSlice: 1,
  borderImageWidth: 1,
  boxFlex: 1,
  boxFlexGroup: 1,
  boxOrdinalGroup: 1,
  columnCount: 1,
  columns: 1,
  flex: 1,
  flexGrow: 1,
  flexPositive: 1,
  flexShrink: 1,
  flexNegative: 1,
  flexOrder: 1,
  gridRow: 1,
  gridRowEnd: 1,
  gridRowSpan: 1,
  gridRowStart: 1,
  gridColumn: 1,
  gridColumnEnd: 1,
  gridColumnSpan: 1,
  gridColumnStart: 1,
  msGridRow: 1,
  msGridRowSpan: 1,
  msGridColumn: 1,
  msGridColumnSpan: 1,
  fontWeight: 1,
  lineHeight: 1,
  opacity: 1,
  order: 1,
  orphans: 1,
  scale: 1,
  tabSize: 1,
  widows: 1,
  zIndex: 1,
  zoom: 1,
  WebkitLineClamp: 1,
  // SVG-related properties
  fillOpacity: 1,
  floodOpacity: 1,
  stopOpacity: 1,
  strokeDasharray: 1,
  strokeDashoffset: 1,
  strokeMiterlimit: 1,
  strokeOpacity: 1,
  strokeWidth: 1
}, I = "-ms-", ge = "-moz-", S = "-webkit-", Et = "comm", je = "rule", tt = "decl", rr = "@import", nr = "@namespace", Rt = "@keyframes", sr = "@layer", Nt = Math.abs, rt = String.fromCharCode, Ke = Object.assign;
function or(e, t) {
  return $(e, 0) ^ 45 ? (((t << 2 ^ $(e, 0)) << 2 ^ $(e, 1)) << 2 ^ $(e, 2)) << 2 ^ $(e, 3) : 0;
}
function kt(e) {
  return e.trim();
}
function W(e, t) {
  return (e = t.exec(e)) ? e[0] : e;
}
function l(e, t, r) {
  return e.replace(t, r);
}
function _e(e, t, r) {
  return e.indexOf(t, r);
}
function $(e, t) {
  return e.charCodeAt(t) | 0;
}
function te(e, t, r) {
  return e.slice(t, r);
}
function G(e) {
  return e.length;
}
function $t(e) {
  return e.length;
}
function le(e, t) {
  return t.push(e), e;
}
function ir(e, t) {
  return e.map(t).join("");
}
function dt(e, t) {
  return e.filter(function(r) {
    return !W(r, t);
  });
}
var De = 1, ie = 1, Ot = 0, j = 0, k = 0, fe = "";
function Me(e, t, r, n, s, o, i, f) {
  return { value: e, root: t, parent: r, type: n, props: s, children: o, line: De, column: ie, length: i, return: "", siblings: f };
}
function U(e, t) {
  return Ke(Me("", null, null, "", null, null, 0, e.siblings), e, { length: -e.length }, t);
}
function se(e) {
  for (; e.root; )
    e = U(e.root, { children: [e] });
  le(e, e.siblings);
}
function ar() {
  return k;
}
function cr() {
  return k = j > 0 ? $(fe, --j) : 0, ie--, k === 10 && (ie = 1, De--), k;
}
function F() {
  return k = j < Ot ? $(fe, j++) : 0, ie++, k === 10 && (ie = 1, De++), k;
}
function V() {
  return $(fe, j);
}
function Pe() {
  return j;
}
function Ge(e, t) {
  return te(fe, e, t);
}
function ye(e) {
  switch (e) {
    // \0 \t \n \r \s whitespace token
    case 0:
    case 9:
    case 10:
    case 13:
    case 32:
      return 5;
    // ! + , / > @ ~ isolate token
    case 33:
    case 43:
    case 44:
    case 47:
    case 62:
    case 64:
    case 126:
    // ; { } breakpoint token
    case 59:
    case 123:
    case 125:
      return 4;
    // : accompanied token
    case 58:
      return 3;
    // " ' ( [ opening delimit token
    case 34:
    case 39:
    case 40:
    case 91:
      return 2;
    // ) ] closing delimit token
    case 41:
    case 93:
      return 1;
  }
  return 0;
}
function ur(e) {
  return De = ie = 1, Ot = G(fe = e), j = 0, [];
}
function fr(e) {
  return fe = "", e;
}
function Be(e) {
  return kt(Ge(j - 1, Ue(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function hr(e) {
  for (; (k = V()) && k < 33; )
    F();
  return ye(e) > 2 || ye(k) > 3 ? "" : " ";
}
function pr(e, t) {
  for (; --t && F() && !(k < 48 || k > 102 || k > 57 && k < 65 || k > 70 && k < 97); )
    ;
  return Ge(e, Pe() + (t < 6 && V() == 32 && F() == 32));
}
function Ue(e) {
  for (; F(); )
    switch (k) {
      // ] ) " '
      case e:
        return j;
      // " '
      case 34:
      case 39:
        e !== 34 && e !== 39 && Ue(k);
        break;
      // (
      case 40:
        e === 41 && Ue(e);
        break;
      // \
      case 92:
        F();
        break;
    }
  return j;
}
function lr(e, t) {
  for (; F() && e + k !== 57; )
    if (e + k === 84 && V() === 47)
      break;
  return "/*" + Ge(t, j - 1) + "*" + rt(e === 47 ? e : F());
}
function dr(e) {
  for (; !ye(V()); )
    F();
  return Ge(e, j);
}
function gr(e) {
  return fr(Ee("", null, null, null, [""], e = ur(e), 0, [0], e));
}
function Ee(e, t, r, n, s, o, i, f, c) {
  for (var p = 0, m = 0, g = i, N = 0, A = 0, y = 0, b = 1, _ = 1, P = 1, E = 0, C = "", u = s, v = o, d = n, a = C; _; )
    switch (y = E, E = F()) {
      // (
      case 40:
        if (y != 108 && $(a, g - 1) == 58) {
          _e(a += l(Be(E), "&", "&\f"), "&\f", Nt(p ? f[p - 1] : 0)) != -1 && (P = -1);
          break;
        }
      // " ' [
      case 34:
      case 39:
      case 91:
        a += Be(E);
        break;
      // \t \n \r \s
      case 9:
      case 10:
      case 13:
      case 32:
        a += hr(y);
        break;
      // \
      case 92:
        a += pr(Pe() - 1, 7);
        continue;
      // /
      case 47:
        switch (V()) {
          case 42:
          case 47:
            le(mr(lr(F(), Pe()), t, r, c), c), (ye(y || 1) == 5 || ye(V() || 1) == 5) && G(a) && te(a, -1, void 0) !== " " && (a += " ");
            break;
          default:
            a += "/";
        }
        break;
      // {
      case 123 * b:
        f[p++] = G(a) * P;
      // } ; \0
      case 125 * b:
      case 59:
      case 0:
        switch (E) {
          // \0 }
          case 0:
          case 125:
            _ = 0;
          // ;
          case 59 + m:
            P == -1 && (a = l(a, /\f/g, "")), A > 0 && (G(a) - g || b === 0 && y === 47) && le(A > 32 ? mt(a + ";", n, r, g - 1, c) : mt(l(a, " ", "") + ";", n, r, g - 2, c), c);
            break;
          // @ ;
          case 59:
            a += ";";
          // { rule/at-rule
          default:
            if (le(d = gt(a, t, r, p, m, s, f, C, u = [], v = [], g, o), o), E === 123)
              if (m === 0)
                Ee(a, t, d, d, u, o, g, f, v);
              else {
                switch (N) {
                  // c(ontainer)
                  case 99:
                    if ($(a, 3) === 110) break;
                  // l(ayer)
                  case 108:
                    if ($(a, 2) === 97) break;
                  default:
                    m = 0;
                  // d(ocument) m(edia) s(upports)
                  case 100:
                  case 109:
                  case 115:
                }
                m ? Ee(e, d, d, n && le(gt(e, d, d, 0, 0, s, f, C, s, u = [], g, v), v), s, v, g, f, n ? u : v) : Ee(a, d, d, d, [""], v, 0, f, v);
              }
        }
        p = m = A = 0, b = P = 1, C = a = "", g = i;
        break;
      // :
      case 58:
        g = 1 + G(a), A = y;
      default:
        if (b < 1) {
          if (E == 123)
            --b;
          else if (E == 125 && b++ == 0 && cr() == 125)
            continue;
        }
        switch (a += rt(E), E * b) {
          // &
          case 38:
            P = m > 0 ? 1 : (a += "\f", -1);
            break;
          // ,
          case 44:
            f[p++] = (G(a) - 1) * P, P = 1;
            break;
          // @
          case 64:
            V() === 45 && (a += Be(F())), N = V(), m = g = G(C = a += dr(Pe())), E++;
            break;
          // -
          case 45:
            y === 45 && G(a) == 2 && (b = 0);
        }
    }
  return o;
}
function gt(e, t, r, n, s, o, i, f, c, p, m, g) {
  for (var N = s - 1, A = s === 0 ? o : [""], y = $t(A), b = 0, _ = 0, P = 0; b < n; ++b)
    for (var E = 0, C = te(e, N + 1, N = Nt(_ = i[b])), u = e; E < y; ++E)
      (u = kt(_ > 0 ? A[E] + " " + C : l(C, /&\f/g, A[E]))) && (c[P++] = u);
  return Me(e, t, r, s === 0 ? je : f, c, p, m, g);
}
function mr(e, t, r, n) {
  return Me(e, t, r, Et, rt(ar()), te(e, 2, -2), 0, n);
}
function mt(e, t, r, n, s) {
  return Me(e, t, r, tt, te(e, 0, n), te(e, n + 1, -1), n, s);
}
function Tt(e, t, r) {
  switch (or(e, t)) {
    // color-adjust
    case 5103:
      return S + "print-" + e + e;
    // animation, animation-(delay|direction|duration|fill-mode|iteration-count|name|play-state|timing-function)
    case 5737:
    case 4201:
    case 3177:
    case 3433:
    case 1641:
    case 4457:
    case 2921:
    // text-decoration, filter, clip-path, backface-visibility, column, box-decoration-break
    case 5572:
    case 6356:
    case 5844:
    case 3191:
    case 6645:
    case 3005:
    // background-clip, columns, column-(count|fill|gap|rule|rule-color|rule-style|rule-width|span|width)
    case 4215:
    case 6389:
    case 5109:
    case 5365:
    case 5621:
    case 3829:
    // mask, mask-image, mask-(mode|clip|size), mask-(repeat|origin), mask-position
    case 6391:
    case 5879:
    case 5623:
    case 6135:
    case 4599:
      return S + e + e;
    // mask-composite
    case 4855:
      return S + e.replace("add", "source-over").replace("substract", "source-out").replace("intersect", "source-in").replace("exclude", "xor") + e;
    // tab-size
    case 4789:
      return ge + e + e;
    // appearance, user-select, transform, hyphens, text-size-adjust
    case 5349:
    case 4246:
    case 4810:
    case 6968:
    case 2756:
      return S + e + ge + e + I + e + e;
    // writing-mode
    case 5936:
      switch ($(e, t + 11)) {
        // vertical-l(r)
        case 114:
          return S + e + I + l(e, /[svh]\w+-[tblr]{2}/, "tb") + e;
        // vertical-r(l)
        case 108:
          return S + e + I + l(e, /[svh]\w+-[tblr]{2}/, "tb-rl") + e;
        // horizontal(-)tb
        case 45:
          return S + e + I + l(e, /[svh]\w+-[tblr]{2}/, "lr") + e;
      }
    // flex, flex-direction, scroll-snap-type, writing-mode
    case 6828:
    case 4268:
    case 2903:
      return S + e + I + e + e;
    // order
    case 6165:
      return S + e + I + "flex-" + e + e;
    // align-items
    case 5187:
      return S + e + l(e, /(\w+).+(:[^]+)/, S + "box-$1$2" + I + "flex-$1$2") + e;
    // align-self
    case 5443:
      return S + e + I + "flex-item-" + l(e, /flex-|-self/g, "") + (W(e, /flex-|baseline/) ? "" : I + "grid-row-" + l(e, /flex-|-self/g, "")) + e;
    // align-content
    case 4675:
      return S + e + I + "flex-line-pack" + l(e, /align-content|flex-|-self/g, "") + e;
    // flex-shrink
    case 5548:
      return S + e + I + l(e, "shrink", "negative") + e;
    // flex-basis
    case 5292:
      return S + e + I + l(e, "basis", "preferred-size") + e;
    // flex-grow
    case 6060:
      return S + "box-" + l(e, "-grow", "") + S + e + I + l(e, "grow", "positive") + e;
    // transition
    case 4554:
      return S + l(e, /([^-])(transform)/g, "$1" + S + "$2") + e;
    // cursor
    case 6187:
      return l(l(l(e, /(zoom-|grab)/, S + "$1"), /(image-set)/, S + "$1"), e, "") + e;
    // background, background-image
    case 5495:
    case 3959:
      return l(e, /(image-set\([^]*)/, S + "$1$`$1");
    // justify-content
    case 4968:
      return l(l(e, /(.+:)(flex-)?(.*)/, S + "box-pack:$3" + I + "flex-pack:$3"), /space-between/, "justify") + S + e + e;
    // justify-self
    case 4200:
      if (!W(e, /flex-|baseline/)) return I + "grid-column-align" + te(e, t) + e;
      break;
    // grid-template-(columns|rows)
    case 2592:
    case 3360:
      return I + l(e, "template-", "") + e;
    // grid-(row|column)-start
    case 4384:
    case 3616:
      return r && r.some(function(n, s) {
        return t = s, W(n.props, /grid-\w+-end/);
      }) ? ~_e(e + (r = r[t].value), "span", 0) ? e : I + l(e, "-start", "") + e + I + "grid-row-span:" + (~_e(r, "span", 0) ? W(r, /\d+/) : +W(r, /\d+/) - +W(e, /\d+/)) + ";" : I + l(e, "-start", "") + e;
    // grid-(row|column)-end
    case 4896:
    case 4128:
      return r && r.some(function(n) {
        return W(n.props, /grid-\w+-start/);
      }) ? e : I + l(l(e, "-end", "-span"), "span ", "") + e;
    // (margin|padding)-inline-(start|end)
    case 4095:
    case 3583:
    case 4068:
    case 2532:
      return l(e, /(.+)-inline(.+)/, S + "$1$2") + e;
    // (min|max)?(width|height|inline-size|block-size)
    case 8116:
    case 7059:
    case 5753:
    case 5535:
    case 5445:
    case 5701:
    case 4933:
    case 4677:
    case 5533:
    case 5789:
    case 5021:
    case 4765:
      if (G(e) - 1 - t > 6)
        switch ($(e, t + 1)) {
          // (m)ax-content, (m)in-content
          case 109:
            if ($(e, t + 4) !== 45)
              break;
          // (f)ill-available, (f)it-content
          case 102:
            return l(e, /(.+:)(.+)-([^]+)/, "$1" + S + "$2-$3$1" + ge + ($(e, t + 3) == 108 ? "$3" : "$2-$3")) + e;
          // (s)tretch
          case 115:
            return ~_e(e, "stretch", 0) ? Tt(l(e, "stretch", "fill-available"), t, r) + e : e;
        }
      break;
    // grid-(column|row)
    case 5152:
    case 5920:
      return l(e, /(.+?):(\d+)(\s*\/\s*(span)?\s*(\d+))?(.*)/, function(n, s, o, i, f, c, p) {
        return I + s + ":" + o + p + (i ? I + s + "-span:" + (f ? c : +c - +o) + p : "") + e;
      });
    // position: sticky
    case 4949:
      if ($(e, t + 6) === 121)
        return l(e, ":", ":" + S) + e;
      break;
    // display: (flex|inline-flex|grid|inline-grid)
    case 6444:
      switch ($(e, $(e, 14) === 45 ? 18 : 11)) {
        // (inline-)?fle(x)
        case 120:
          return l(e, /(.+:)([^;\s!]+)(;|(\s+)?!.+)?/, "$1" + S + ($(e, 14) === 45 ? "inline-" : "") + "box$3$1" + S + "$2$3$1" + I + "$2box$3") + e;
        // (inline-)?gri(d)
        case 100:
          return l(e, ":", ":" + I) + e;
      }
      break;
    // scroll-margin, scroll-margin-(top|right|bottom|left)
    case 5719:
    case 2647:
    case 2135:
    case 3927:
    case 2391:
      return l(e, "scroll-", "scroll-snap-") + e;
  }
  return e;
}
function ke(e, t) {
  for (var r = "", n = 0; n < e.length; n++)
    r += t(e[n], n, e, t) || "";
  return r;
}
function yr(e, t, r, n) {
  switch (e.type) {
    case sr:
      if (e.children.length) break;
    case rr:
    case nr:
    case tt:
      return e.return = e.return || e.value;
    case Et:
      return "";
    case Rt:
      return e.return = e.value + "{" + ke(e.children, n) + "}";
    case je:
      if (!G(e.value = e.props.join(","))) return "";
  }
  return G(r = ke(e.children, n)) ? e.return = e.value + "{" + r + "}" : "";
}
function vr(e) {
  var t = $t(e);
  return function(r, n, s, o) {
    for (var i = "", f = 0; f < t; f++)
      i += e[f](r, n, s, o) || "";
    return i;
  };
}
function Sr(e) {
  return function(t) {
    t.root || (t = t.return) && e(t);
  };
}
function br(e, t, r, n) {
  if (e.length > -1 && !e.return)
    switch (e.type) {
      case tt:
        e.return = Tt(e.value, e.length, r);
        return;
      case Rt:
        return ke([U(e, { value: l(e.value, "@", "@" + S) })], n);
      case je:
        if (e.length)
          return ir(r = e.props, function(s) {
            switch (W(s, n = /(::plac\w+|:read-\w+)/)) {
              // :read-(only|write)
              case ":read-only":
              case ":read-write":
                se(U(e, { props: [l(s, /:(read-\w+)/, ":" + ge + "$1")] })), se(U(e, { props: [s] })), Ke(e, { props: dt(r, n) });
                break;
              // :placeholder
              case "::placeholder":
                se(U(e, { props: [l(s, /:(plac\w+)/, ":" + S + "input-$1")] })), se(U(e, { props: [l(s, /:(plac\w+)/, ":" + ge + "$1")] })), se(U(e, { props: [l(s, /:(plac\w+)/, I + "input-$1")] })), se(U(e, { props: [s] })), Ke(e, { props: dt(r, n) });
                break;
            }
            return "";
          });
    }
}
var J = typeof process < "u" && process.env !== void 0 && (process.env.REACT_APP_SC_ATTR || process.env.SC_ATTR) || "data-styled", jt = "active", $e = "data-styled-version", ae = "6.3.12", nt = `/*!sc*/
`, me = typeof window < "u" && typeof document < "u", wr = !!(typeof SC_DISABLE_SPEEDY == "boolean" ? SC_DISABLE_SPEEDY : typeof process < "u" && process.env !== void 0 && process.env.REACT_APP_SC_DISABLE_SPEEDY !== void 0 && process.env.REACT_APP_SC_DISABLE_SPEEDY !== "" ? process.env.REACT_APP_SC_DISABLE_SPEEDY !== "false" && process.env.REACT_APP_SC_DISABLE_SPEEDY : typeof process < "u" && process.env !== void 0 && process.env.SC_DISABLE_SPEEDY !== void 0 && process.env.SC_DISABLE_SPEEDY !== "" && process.env.SC_DISABLE_SPEEDY !== "false" && process.env.SC_DISABLE_SPEEDY), Cr = {};
function T(e) {
  for (var t = [], r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
  return new Error("An error occurred. See https://github.com/styled-components/styled-components/blob/main/packages/styled-components/src/utils/errors.md#".concat(e, " for more information.").concat(t.length > 0 ? " Args: ".concat(t.join(", ")) : ""));
}
var Re = /* @__PURE__ */ new Map(), Oe = /* @__PURE__ */ new Map(), Ne = 1, de = function(e) {
  if (Re.has(e)) return Re.get(e);
  for (; Oe.has(Ne); ) Ne++;
  var t = Ne++;
  return Re.set(e, t), Oe.set(t, e), t;
}, Ar = function(e, t) {
  Ne = t + 1, Re.set(e, t), Oe.set(t, e);
}, st = Object.freeze([]), ce = Object.freeze({});
function ot(e, t, r) {
  return r === void 0 && (r = ce), e.theme !== r.theme && e.theme || t || r.theme;
}
var Dt = /* @__PURE__ */ new Set(["a", "abbr", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "blockquote", "body", "button", "br", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "menu", "meter", "nav", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "slot", "small", "span", "strong", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var", "video", "wbr", "circle", "clipPath", "defs", "ellipse", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "filter", "foreignObject", "g", "image", "line", "linearGradient", "marker", "mask", "path", "pattern", "polygon", "polyline", "radialGradient", "rect", "stop", "svg", "switch", "symbol", "text", "textPath", "tspan", "use"]), Ir = /[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~-]+/g, xr = /(^-|-$)/g;
function yt(e) {
  return e.replace(Ir, "-").replace(xr, "");
}
var _r = /(a)(d)/gi, vt = function(e) {
  return String.fromCharCode(e + (e > 25 ? 39 : 97));
};
function Ve(e) {
  var t, r = "";
  for (t = Math.abs(e); t > 52; t = t / 52 | 0) r = vt(t % 52) + r;
  return (vt(t % 52) + r).replace(_r, "$1-$2");
}
var We, Q = function(e, t) {
  for (var r = t.length; r; ) e = 33 * e ^ t.charCodeAt(--r);
  return e;
}, Mt = function(e) {
  return Q(5381, e);
};
function it(e) {
  return Ve(Mt(e) >>> 0);
}
function Gt(e) {
  return e.displayName || e.name || "Component";
}
function Ye(e) {
  return typeof e == "string" && !0;
}
var Ft = typeof Symbol == "function" && Symbol.for, zt = Ft ? Symbol.for("react.memo") : 60115, Pr = Ft ? Symbol.for("react.forward_ref") : 60112, Er = { childContextTypes: !0, contextType: !0, contextTypes: !0, defaultProps: !0, displayName: !0, getDefaultProps: !0, getDerivedStateFromError: !0, getDerivedStateFromProps: !0, mixins: !0, propTypes: !0, type: !0 }, Rr = { name: !0, length: !0, prototype: !0, caller: !0, callee: !0, arguments: !0, arity: !0 }, Lt = { $$typeof: !0, compare: !0, defaultProps: !0, displayName: !0, propTypes: !0, type: !0 }, Nr = ((We = {})[Pr] = { $$typeof: !0, render: !0, defaultProps: !0, displayName: !0, propTypes: !0 }, We[zt] = Lt, We);
function St(e) {
  return ("type" in (t = e) && t.type.$$typeof) === zt ? Lt : "$$typeof" in e ? Nr[e.$$typeof] : Er;
  var t;
}
var kr = Object.defineProperty, $r = Object.getOwnPropertyNames, bt = Object.getOwnPropertySymbols, Or = Object.getOwnPropertyDescriptor, Tr = Object.getPrototypeOf, wt = Object.prototype;
function at(e, t, r) {
  if (typeof t != "string") {
    if (wt) {
      var n = Tr(t);
      n && n !== wt && at(e, n, r);
    }
    var s = $r(t);
    bt && (s = s.concat(bt(t)));
    for (var o = St(e), i = St(t), f = 0; f < s.length; ++f) {
      var c = s[f];
      if (!(c in Rr || r && r[c] || i && c in i || o && c in o)) {
        var p = Or(t, c);
        try {
          kr(e, c, p);
        } catch {
        }
      }
    }
  }
  return e;
}
function re(e) {
  return typeof e == "function";
}
function ct(e) {
  return typeof e == "object" && "styledComponentId" in e;
}
function ee(e, t) {
  return e && t ? "".concat(e, " ").concat(t) : e || t || "";
}
function ve(e, t) {
  return e.join(t || "");
}
function Se(e) {
  return e !== null && typeof e == "object" && e.constructor.name === Object.name && !("props" in e && e.$$typeof);
}
function Ze(e, t, r) {
  if (r === void 0 && (r = !1), !r && !Se(e) && !Array.isArray(e)) return t;
  if (Array.isArray(t)) for (var n = 0; n < t.length; n++) e[n] = Ze(e[n], t[n]);
  else if (Se(t)) for (var n in t) e[n] = Ze(e[n], t[n]);
  return e;
}
function ut(e, t) {
  Object.defineProperty(e, "toString", { value: t });
}
var jr = (function() {
  function e(t) {
    this.groupSizes = new Uint32Array(512), this.length = 512, this.tag = t, this._cGroup = 0, this._cIndex = 0;
  }
  return e.prototype.indexOfGroup = function(t) {
    if (t === this._cGroup) return this._cIndex;
    var r = this._cIndex;
    if (t > this._cGroup) for (var n = this._cGroup; n < t; n++) r += this.groupSizes[n];
    else for (n = this._cGroup - 1; n >= t; n--) r -= this.groupSizes[n];
    return this._cGroup = t, this._cIndex = r, r;
  }, e.prototype.insertRules = function(t, r) {
    if (t >= this.groupSizes.length) {
      for (var n = this.groupSizes, s = n.length, o = s; t >= o; ) if ((o <<= 1) < 0) throw T(16, "".concat(t));
      this.groupSizes = new Uint32Array(o), this.groupSizes.set(n), this.length = o;
      for (var i = s; i < o; i++) this.groupSizes[i] = 0;
    }
    for (var f = this.indexOfGroup(t + 1), c = 0, p = (i = 0, r.length); i < p; i++) this.tag.insertRule(f, r[i]) && (this.groupSizes[t]++, f++, c++);
    c > 0 && this._cGroup > t && (this._cIndex += c);
  }, e.prototype.clearGroup = function(t) {
    if (t < this.length) {
      var r = this.groupSizes[t], n = this.indexOfGroup(t), s = n + r;
      this.groupSizes[t] = 0;
      for (var o = n; o < s; o++) this.tag.deleteRule(n);
      r > 0 && this._cGroup > t && (this._cIndex -= r);
    }
  }, e.prototype.getGroup = function(t) {
    var r = "";
    if (t >= this.length || this.groupSizes[t] === 0) return r;
    for (var n = this.groupSizes[t], s = this.indexOfGroup(t), o = s + n, i = s; i < o; i++) r += this.tag.getRule(i) + nt;
    return r;
  }, e;
})(), Dr = "style[".concat(J, "][").concat($e, '="').concat(ae, '"]'), Mr = new RegExp("^".concat(J, '\\.g(\\d+)\\[id="([\\w\\d-]+)"\\].*?"([^"]*)')), Ct = function(e) {
  return typeof ShadowRoot < "u" && e instanceof ShadowRoot || "host" in e && e.nodeType === 11;
}, Je = function(e) {
  if (!e) return document;
  if (Ct(e)) return e;
  if ("getRootNode" in e) {
    var t = e.getRootNode();
    if (Ct(t)) return t;
  }
  return document;
}, Gr = function(e, t, r) {
  for (var n, s = r.split(","), o = 0, i = s.length; o < i; o++) (n = s[o]) && e.registerName(t, n);
}, Fr = function(e, t) {
  for (var r, n = ((r = t.textContent) !== null && r !== void 0 ? r : "").split(nt), s = [], o = 0, i = n.length; o < i; o++) {
    var f = n[o].trim();
    if (f) {
      var c = f.match(Mr);
      if (c) {
        var p = 0 | parseInt(c[1], 10), m = c[2];
        p !== 0 && (Ar(m, p), Gr(e, m, c[3]), e.getTag().insertRules(p, s)), s.length = 0;
      } else s.push(f);
    }
  }
}, He = function(e) {
  for (var t = Je(e.options.target).querySelectorAll(Dr), r = 0, n = t.length; r < n; r++) {
    var s = t[r];
    s && s.getAttribute(J) !== jt && (Fr(e, s), s.parentNode && s.parentNode.removeChild(s));
  }
};
function Qe() {
  return typeof __webpack_nonce__ < "u" ? __webpack_nonce__ : null;
}
var Bt = function(e) {
  var t = document.head, r = e || t, n = document.createElement("style"), s = (function(f) {
    var c = Array.from(f.querySelectorAll("style[".concat(J, "]")));
    return c[c.length - 1];
  })(r), o = s !== void 0 ? s.nextSibling : null;
  n.setAttribute(J, jt), n.setAttribute($e, ae);
  var i = Qe();
  return i && n.setAttribute("nonce", i), r.insertBefore(n, o), n;
}, zr = (function() {
  function e(t) {
    this.element = Bt(t), this.element.appendChild(document.createTextNode("")), this.sheet = (function(r) {
      var n;
      if (r.sheet) return r.sheet;
      for (var s = (n = r.getRootNode().styleSheets) !== null && n !== void 0 ? n : document.styleSheets, o = 0, i = s.length; o < i; o++) {
        var f = s[o];
        if (f.ownerNode === r) return f;
      }
      throw T(17);
    })(this.element), this.length = 0;
  }
  return e.prototype.insertRule = function(t, r) {
    try {
      return this.sheet.insertRule(r, t), this.length++, !0;
    } catch {
      return !1;
    }
  }, e.prototype.deleteRule = function(t) {
    this.sheet.deleteRule(t), this.length--;
  }, e.prototype.getRule = function(t) {
    var r = this.sheet.cssRules[t];
    return r && r.cssText ? r.cssText : "";
  }, e;
})(), Lr = (function() {
  function e(t) {
    this.element = Bt(t), this.nodes = this.element.childNodes, this.length = 0;
  }
  return e.prototype.insertRule = function(t, r) {
    if (t <= this.length && t >= 0) {
      var n = document.createTextNode(r);
      return this.element.insertBefore(n, this.nodes[t] || null), this.length++, !0;
    }
    return !1;
  }, e.prototype.deleteRule = function(t) {
    this.element.removeChild(this.nodes[t]), this.length--;
  }, e.prototype.getRule = function(t) {
    return t < this.length ? this.nodes[t].textContent : "";
  }, e;
})(), Br = (function() {
  function e(t) {
    this.rules = [], this.length = 0;
  }
  return e.prototype.insertRule = function(t, r) {
    return t <= this.length && (t === this.length ? this.rules.push(r) : this.rules.splice(t, 0, r), this.length++, !0);
  }, e.prototype.deleteRule = function(t) {
    this.rules.splice(t, 1), this.length--;
  }, e.prototype.getRule = function(t) {
    return t < this.length ? this.rules[t] : "";
  }, e;
})(), At = me, Wr = { isServer: !me, useCSSOMInjection: !wr }, ue = (function() {
  function e(t, r, n) {
    t === void 0 && (t = ce), r === void 0 && (r = {});
    var s = this;
    this.options = R(R({}, Wr), t), this.gs = r, this.names = new Map(n), this.server = !!t.isServer, !this.server && me && At && (At = !1, He(this)), ut(this, function() {
      return (function(o) {
        for (var i = o.getTag(), f = i.length, c = "", p = function(g) {
          var N = (function(P) {
            return Oe.get(P);
          })(g);
          if (N === void 0) return "continue";
          var A = o.names.get(N);
          if (A === void 0 || !A.size) return "continue";
          var y = i.getGroup(g);
          if (y.length === 0) return "continue";
          var b = J + ".g" + g + '[id="' + N + '"]', _ = "";
          A.forEach(function(P) {
            P.length > 0 && (_ += P + ",");
          }), c += y + b + '{content:"' + _ + '"}' + nt;
        }, m = 0; m < f; m++) p(m);
        return c;
      })(s);
    });
  }
  return e.registerId = function(t) {
    return de(t);
  }, e.prototype.rehydrate = function() {
    !this.server && me && He(this);
  }, e.prototype.reconstructWithOptions = function(t, r) {
    r === void 0 && (r = !0);
    var n = new e(R(R({}, this.options), t), this.gs, r && this.names || void 0);
    return !this.server && me && t.target !== this.options.target && Je(this.options.target) !== Je(t.target) && He(n), n;
  }, e.prototype.allocateGSInstance = function(t) {
    return this.gs[t] = (this.gs[t] || 0) + 1;
  }, e.prototype.getTag = function() {
    return this.tag || (this.tag = (t = (function(r) {
      var n = r.useCSSOMInjection, s = r.target;
      return r.isServer ? new Br(s) : n ? new zr(s) : new Lr(s);
    })(this.options), new jr(t)));
    var t;
  }, e.prototype.hasNameForId = function(t, r) {
    var n, s;
    return (s = (n = this.names.get(t)) === null || n === void 0 ? void 0 : n.has(r)) !== null && s !== void 0 && s;
  }, e.prototype.registerName = function(t, r) {
    de(t);
    var n = this.names.get(t);
    n ? n.add(r) : this.names.set(t, /* @__PURE__ */ new Set([r]));
  }, e.prototype.insertRules = function(t, r, n) {
    this.registerName(t, r), this.getTag().insertRules(de(t), n);
  }, e.prototype.clearNames = function(t) {
    this.names.has(t) && this.names.get(t).clear();
  }, e.prototype.clearRules = function(t) {
    this.getTag().clearGroup(de(t)), this.clearNames(t);
  }, e.prototype.clearTag = function() {
    this.tag = void 0;
  }, e;
})();
function Yr(e, t) {
  return t == null || typeof t == "boolean" || t === "" ? "" : typeof t != "number" || t === 0 || e in tr || e.startsWith("--") ? String(t).trim() : "".concat(t, "px");
}
var Hr = function(e) {
  return e >= "A" && e <= "Z";
};
function It(e) {
  for (var t = "", r = 0; r < e.length; r++) {
    var n = e[r];
    if (r === 1 && n === "-" && e[0] === "-") return e;
    Hr(n) ? t += "-" + n.toLowerCase() : t += n;
  }
  return t.startsWith("ms-") ? "-" + t : t;
}
var Wt = Symbol.for("sc-keyframes");
function qr(e) {
  return typeof e == "object" && e !== null && Wt in e;
}
var Yt = function(e) {
  return e == null || e === !1 || e === "";
}, Ht = function(e) {
  var t = [];
  for (var r in e) {
    var n = e[r];
    e.hasOwnProperty(r) && !Yt(n) && (Array.isArray(n) && n.isCss || re(n) ? t.push("".concat(It(r), ":"), n, ";") : Se(n) ? t.push.apply(t, oe(oe(["".concat(r, " {")], Ht(n), !1), ["}"], !1)) : t.push("".concat(It(r), ": ").concat(Yr(r, n), ";")));
  }
  return t;
};
function Z(e, t, r, n, s) {
  if (s === void 0 && (s = []), typeof e == "string") return e && s.push(e), s;
  if (Yt(e)) return s;
  if (ct(e)) return s.push(".".concat(e.styledComponentId)), s;
  if (re(e)) {
    if (!re(i = e) || i.prototype && i.prototype.isReactComponent || !t) return s.push(e), s;
    var o = e(t);
    return Z(o, t, r, n, s);
  }
  var i;
  if (qr(e)) return r ? (e.inject(r, n), s.push(e.getName(n))) : s.push(e), s;
  if (Se(e)) {
    for (var f = Ht(e), c = 0; c < f.length; c++) s.push(f[c]);
    return s;
  }
  if (!Array.isArray(e)) return s.push(e.toString()), s;
  for (c = 0; c < e.length; c++) Z(e[c], t, r, n, s);
  return s;
}
function qt(e) {
  for (var t = 0; t < e.length; t += 1) {
    var r = e[t];
    if (re(r) && !ct(r)) return !1;
  }
  return !0;
}
var Kr = Mt(ae), Ur = (function() {
  function e(t, r, n) {
    this.rules = t, this.staticRulesId = "", this.isStatic = (n === void 0 || n.isStatic) && qt(t), this.componentId = r, this.baseHash = Q(Kr, r), this.baseStyle = n, ue.registerId(r);
  }
  return e.prototype.generateAndInjectStyles = function(t, r, n) {
    var s = this.baseStyle ? this.baseStyle.generateAndInjectStyles(t, r, n).className : "";
    if (this.isStatic && !n.hash) if (this.staticRulesId && r.hasNameForId(this.componentId, this.staticRulesId)) s = ee(s, this.staticRulesId);
    else {
      var o = ve(Z(this.rules, t, r, n)), i = Ve(Q(this.baseHash, o) >>> 0);
      if (!r.hasNameForId(this.componentId, i)) {
        var f = n(o, ".".concat(i), void 0, this.componentId);
        r.insertRules(this.componentId, i, f);
      }
      s = ee(s, i), this.staticRulesId = i;
    }
    else {
      for (var c = Q(this.baseHash, n.hash), p = "", m = 0; m < this.rules.length; m++) {
        var g = this.rules[m];
        if (typeof g == "string") p += g;
        else if (g) {
          var N = ve(Z(g, t, r, n));
          c = Q(Q(c, String(m)), N), p += N;
        }
      }
      if (p) {
        var A = Ve(c >>> 0);
        if (!r.hasNameForId(this.componentId, A)) {
          var y = n(p, ".".concat(A), void 0, this.componentId);
          r.insertRules(this.componentId, A, y);
        }
        s = ee(s, A);
      }
    }
    return { className: s, css: typeof window > "u" ? r.getTag().getGroup(de(this.componentId)) : "" };
  }, e;
})(), Vr = /&/g, Y = 47, X = 42;
function xt(e) {
  if (e.indexOf("}") === -1) return !1;
  for (var t = e.length, r = 0, n = 0, s = !1, o = 0; o < t; o++) {
    var i = e.charCodeAt(o);
    if (n !== 0 || s || i !== Y || e.charCodeAt(o + 1) !== X) if (s) i === X && e.charCodeAt(o + 1) === Y && (s = !1, o++);
    else if (i !== 34 && i !== 39 || o !== 0 && e.charCodeAt(o - 1) === 92) {
      if (n === 0) {
        if (i === 123) r++;
        else if (i === 125 && --r < 0) return !0;
      }
    } else n === 0 ? n = i : n === i && (n = 0);
    else s = !0, o++;
  }
  return r !== 0 || n !== 0;
}
function Kt(e, t) {
  return e.map(function(r) {
    return r.type === "rule" && (r.value = "".concat(t, " ").concat(r.value), r.value = r.value.replaceAll(",", ",".concat(t, " ")), r.props = r.props.map(function(n) {
      return "".concat(t, " ").concat(n);
    })), Array.isArray(r.children) && r.type !== "@keyframes" && (r.children = Kt(r.children, t)), r;
  });
}
function Ut(e) {
  var t, r, n, s = e === void 0 ? ce : e, o = s.options, i = o === void 0 ? ce : o, f = s.plugins, c = f === void 0 ? st : f, p = function(y, b, _) {
    return _.startsWith(r) && _.endsWith(r) && _.replaceAll(r, "").length > 0 ? ".".concat(t) : y;
  }, m = c.slice();
  m.push(function(y) {
    y.type === je && y.value.includes("&") && (n || (n = new RegExp("\\".concat(r, "\\b"), "g")), y.props[0] = y.props[0].replace(Vr, r).replace(n, p));
  }), i.prefix && m.push(br), m.push(yr);
  var g = [], N = vr(m.concat(Sr(function(y) {
    return g.push(y);
  }))), A = function(y, b, _, P) {
    b === void 0 && (b = ""), _ === void 0 && (_ = ""), P === void 0 && (P = "&"), t = P, r = b, n = void 0;
    var E = (function(u) {
      if (!xt(u)) return u;
      for (var v = u.length, d = "", a = 0, h = 0, O = 0, D = !1, w = 0; w < v; w++) {
        var M = u.charCodeAt(w);
        if (O !== 0 || D || M !== Y || u.charCodeAt(w + 1) !== X) if (D) M === X && u.charCodeAt(w + 1) === Y && (D = !1, w++);
        else if (M !== 34 && M !== 39 || w !== 0 && u.charCodeAt(w - 1) === 92) {
          if (O === 0) if (M === 123) h++;
          else if (M === 125) {
            if (--h < 0) {
              for (var z = w + 1; z < v; ) {
                var be = u.charCodeAt(z);
                if (be === 59 || be === 10) break;
                z++;
              }
              z < v && u.charCodeAt(z) === 59 && z++, h = 0, w = z - 1, a = z;
              continue;
            }
            h === 0 && (d += u.substring(a, w + 1), a = w + 1);
          } else M === 59 && h === 0 && (d += u.substring(a, w + 1), a = w + 1);
        } else O === 0 ? O = M : O === M && (O = 0);
        else D = !0, w++;
      }
      if (a < v) {
        var we = u.substring(a);
        xt(we) || (d += we);
      }
      return d;
    })((function(u) {
      if (u.indexOf("//") === -1) return u;
      for (var v = u.length, d = [], a = 0, h = 0, O = 0, D = 0; h < v; ) {
        var w = u.charCodeAt(h);
        if (w !== 34 && w !== 39 || h !== 0 && u.charCodeAt(h - 1) === 92) if (O === 0) if (w === Y && h + 1 < v && u.charCodeAt(h + 1) === X) {
          for (h += 2; h + 1 < v && (u.charCodeAt(h) !== X || u.charCodeAt(h + 1) !== Y); ) h++;
          h += 2;
        } else if (w === 40 && h >= 3 && (32 | u.charCodeAt(h - 1)) == 108 && (32 | u.charCodeAt(h - 2)) == 114 && (32 | u.charCodeAt(h - 3)) == 117) D = 1, h++;
        else if (D > 0) w === 41 ? D-- : w === 40 && D++, h++;
        else if (w === X && h + 1 < v && u.charCodeAt(h + 1) === Y) h > a && d.push(u.substring(a, h)), a = h += 2;
        else if (w === Y && h + 1 < v && u.charCodeAt(h + 1) === Y) {
          for (h > a && d.push(u.substring(a, h)); h < v && u.charCodeAt(h) !== 10; ) h++;
          a = h;
        } else h++;
        else h++;
        else O === 0 ? O = w : O === w && (O = 0), h++;
      }
      return a === 0 ? u : (a < v && d.push(u.substring(a)), d.join(""));
    })(y)), C = gr(_ || b ? "".concat(_, " ").concat(b, " { ").concat(E, " }") : E);
    return i.namespace && (C = Kt(C, i.namespace)), g = [], ke(C, N), g;
  };
  return A.hash = c.length ? c.reduce(function(y, b) {
    return b.name || T(15), Q(y, b.name);
  }, 5381).toString() : "", A;
}
var Vt = new ue(), Xe = Ut(), ft = x.createContext({ shouldForwardProp: void 0, styleSheet: Vt, stylis: Xe }), nn = ft.Consumer, Zr = x.createContext(void 0);
function Te() {
  return x.useContext(ft);
}
function Jr(e) {
  if (!x.useMemo) return e.children;
  var t = Te().styleSheet, r = x.useMemo(function() {
    var o = t;
    return e.sheet ? o = e.sheet : e.target && (o = o.reconstructWithOptions({ target: e.target }, !1)), e.disableCSSOMInjection && (o = o.reconstructWithOptions({ useCSSOMInjection: !1 })), o;
  }, [e.disableCSSOMInjection, e.sheet, e.target, t]), n = x.useMemo(function() {
    return Ut({ options: { namespace: e.namespace, prefix: e.enableVendorPrefixes }, plugins: e.stylisPlugins });
  }, [e.enableVendorPrefixes, e.namespace, e.stylisPlugins]), s = x.useMemo(function() {
    return { shouldForwardProp: e.shouldForwardProp, styleSheet: r, stylis: n };
  }, [e.shouldForwardProp, r, n]);
  return x.createElement(ft.Provider, { value: s }, x.createElement(Zr.Provider, { value: n }, e.children));
}
var ne = x.createContext(void 0), sn = ne.Consumer;
function on() {
  var e = x.useContext(ne);
  if (!e) throw T(18);
  return e;
}
function an(e) {
  var t = x.useContext(ne), r = x.useMemo(function() {
    return (function(n, s) {
      if (!n) throw T(14);
      if (re(n)) {
        var o = n(s);
        return o;
      }
      if (Array.isArray(n) || typeof n != "object") throw T(8);
      return s ? R(R({}, s), n) : n;
    })(e.theme, t);
  }, [e.theme, t]);
  return e.children ? x.createElement(ne.Provider, { value: r }, e.children) : null;
}
var qe = {};
function Qr(e, t, r) {
  var n = ct(e), s = e, o = !Ye(e), i = t.attrs, f = i === void 0 ? st : i, c = t.componentId, p = c === void 0 ? (function(u, v) {
    var d = typeof u != "string" ? "sc" : yt(u);
    qe[d] = (qe[d] || 0) + 1;
    var a = "".concat(d, "-").concat(it(ae + d + qe[d]));
    return v ? "".concat(v, "-").concat(a) : a;
  })(t.displayName, t.parentComponentId) : c, m = t.displayName, g = m === void 0 ? (function(u) {
    return Ye(u) ? "styled.".concat(u) : "Styled(".concat(Gt(u), ")");
  })(e) : m, N = t.displayName && t.componentId ? "".concat(yt(t.displayName), "-").concat(t.componentId) : t.componentId || p, A = n && s.attrs ? s.attrs.concat(f).filter(Boolean) : f, y = t.shouldForwardProp;
  if (n && s.shouldForwardProp) {
    var b = s.shouldForwardProp;
    if (t.shouldForwardProp) {
      var _ = t.shouldForwardProp;
      y = function(u, v) {
        return b(u, v) && _(u, v);
      };
    } else y = b;
  }
  var P = new Ur(r, N, n ? s.componentStyle : void 0);
  function E(u, v) {
    return (function(d, a, h) {
      var O = d.attrs, D = d.componentStyle, w = d.defaultProps, M = d.foldedComponentIds, z = d.styledComponentId, be = d.target, we = x.useContext(ne), Qt = Te(), Fe = d.shouldForwardProp || Qt.shouldForwardProp, pt = ot(a, we, w) || ce, L = (function(Ae, q, Ie) {
        for (var pe, B = R(R({}, q), { className: void 0, theme: Ie }), Le = 0; Le < Ae.length; Le += 1) {
          var xe = re(pe = Ae[Le]) ? pe(B) : pe;
          for (var K in xe) K === "className" ? B.className = ee(B.className, xe[K]) : K === "style" ? B.style = R(R({}, B.style), xe[K]) : K in q && q[K] === void 0 || (B[K] = xe[K]);
        }
        return "className" in q && typeof q.className == "string" && (B.className = ee(B.className, q.className)), B;
      })(O, a, pt), Ce = L.as || be, he = {};
      for (var H in L) L[H] === void 0 || H[0] === "$" || H === "as" || H === "theme" && L.theme === pt || (H === "forwardedAs" ? he.as = L.forwardedAs : Fe && !Fe(H, Ce) || (he[H] = L[H]));
      var Xt = (function(Ae, q) {
        var Ie = Te(), pe = Ae.generateAndInjectStyles(q, Ie.styleSheet, Ie.stylis);
        return pe;
      })(D, L), lt = Xt.className, ze = ee(M, z);
      return lt && (ze += " " + lt), L.className && (ze += " " + L.className), he[Ye(Ce) && !Dt.has(Ce) ? "class" : "className"] = ze, h && (he.ref = h), er(Ce, he);
    })(C, u, v);
  }
  E.displayName = g;
  var C = x.forwardRef(E);
  return C.attrs = A, C.componentStyle = P, C.displayName = g, C.shouldForwardProp = y, C.foldedComponentIds = n ? ee(s.foldedComponentIds, s.styledComponentId) : "", C.styledComponentId = N, C.target = n ? s.target : e, Object.defineProperty(C, "defaultProps", { get: function() {
    return this._foldedDefaultProps;
  }, set: function(u) {
    this._foldedDefaultProps = n ? (function(v) {
      for (var d = [], a = 1; a < arguments.length; a++) d[a - 1] = arguments[a];
      for (var h = 0, O = d; h < O.length; h++) Ze(v, O[h], !0);
      return v;
    })({}, s.defaultProps, u) : u;
  } }), ut(C, function() {
    return ".".concat(C.styledComponentId);
  }), o && at(C, e, { attrs: !0, componentStyle: !0, displayName: !0, foldedComponentIds: !0, shouldForwardProp: !0, styledComponentId: !0, target: !0 }), C;
}
function _t(e, t) {
  for (var r = [e[0]], n = 0, s = t.length; n < s; n += 1) r.push(t[n], e[n + 1]);
  return r;
}
var Pt = function(e) {
  return Object.assign(e, { isCss: !0 });
};
function ht(e) {
  for (var t = [], r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
  if (re(e) || Se(e)) return Pt(Z(_t(st, oe([e], t, !0))));
  var n = e;
  return t.length === 0 && n.length === 1 && typeof n[0] == "string" ? Z(n) : Pt(Z(_t(n, t)));
}
function et(e, t, r) {
  if (r === void 0 && (r = ce), !t) throw T(1, t);
  var n = function(s) {
    for (var o = [], i = 1; i < arguments.length; i++) o[i - 1] = arguments[i];
    return e(t, r, ht.apply(void 0, oe([s], o, !1)));
  };
  return n.attrs = function(s) {
    return et(e, t, R(R({}, r), { attrs: Array.prototype.concat(r.attrs, s).filter(Boolean) }));
  }, n.withConfig = function(s) {
    return et(e, t, R(R({}, r), s));
  }, n;
}
var Zt = function(e) {
  return et(Qr, e);
}, Xr = Zt;
Dt.forEach(function(e) {
  Xr[e] = Zt(e);
});
var Jt, en = (function() {
  function e(t, r) {
    this.rules = t, this.componentId = r, this.isStatic = qt(t), ue.registerId(this.componentId + 1);
  }
  return e.prototype.createStyles = function(t, r, n, s) {
    var o = s(ve(Z(this.rules, r, n, s)), ""), i = this.componentId + t;
    n.insertRules(i, i, o);
  }, e.prototype.removeStyles = function(t, r) {
    r.clearRules(this.componentId + t);
  }, e.prototype.renderStyles = function(t, r, n, s) {
    t > 2 && ue.registerId(this.componentId + t);
    var o = this.componentId + t;
    this.isStatic ? n.hasNameForId(o, o) || this.createStyles(t, r, n, s) : (this.removeStyles(t, n), this.createStyles(t, r, n, s));
  }, e;
})();
function cn(e) {
  for (var t = [], r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
  var n = ht.apply(void 0, oe([e], t, !1)), s = "sc-global-".concat(it(JSON.stringify(n))), o = new en(n, s), i = /* @__PURE__ */ new WeakMap(), f = function(c) {
    var p = Te(), m = x.useContext(ne), g = i.get(p.styleSheet);
    return g === void 0 && (g = p.styleSheet.allocateGSInstance(s), i.set(p.styleSheet, g)), x.useLayoutEffect(function() {
      return p.styleSheet.server || (function(N, A, y, b, _) {
        if (o.isStatic) o.renderStyles(N, Cr, y, _);
        else {
          var P = R(R({}, A), { theme: ot(A, b, f.defaultProps) });
          o.renderStyles(N, P, y, _);
        }
      })(g, c, p.styleSheet, m, p.stylis), function() {
        o.removeStyles(g, p.styleSheet);
      };
    }, [g, c, p.styleSheet, m, p.stylis]), null;
  };
  return x.memo(f);
}
var tn = (function() {
  function e(t, r) {
    var n = this;
    this[Jt] = !0, this.inject = function(s, o) {
      o === void 0 && (o = Xe);
      var i = n.name + o.hash;
      s.hasNameForId(n.id, i) || s.insertRules(n.id, i, o(n.rules, i, "@keyframes"));
    }, this.name = t, this.id = "sc-keyframes-".concat(t), this.rules = r, ut(this, function() {
      throw T(12, String(n.name));
    });
  }
  return e.prototype.getName = function(t) {
    return t === void 0 && (t = Xe), this.name + t.hash;
  }, e;
})();
function un(e) {
  for (var t = [], r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
  var n = ve(ht.apply(void 0, oe([e], t, !1))), s = it(n);
  return new tn(s, n);
}
function fn(e) {
  var t = x.forwardRef(function(r, n) {
    var s = ot(r, x.useContext(ne), e.defaultProps);
    return x.createElement(e, R(R({}, r), { theme: s, ref: n }));
  });
  return t.displayName = "WithTheme(".concat(Gt(e), ")"), at(t, e);
}
Jt = Wt;
var hn = (function() {
  function e() {
    var t = this;
    this._emitSheetCSS = function() {
      var r = t.instance.toString();
      if (!r) return "";
      var n = Qe(), s = ve([n && 'nonce="'.concat(n, '"'), "".concat(J, '="true"'), "".concat($e, '="').concat(ae, '"')].filter(Boolean), " ");
      return "<style ".concat(s, ">").concat(r, "</style>");
    }, this.getStyleTags = function() {
      if (t.sealed) throw T(2);
      return t._emitSheetCSS();
    }, this.getStyleElement = function() {
      var r;
      if (t.sealed) throw T(2);
      var n = t.instance.toString();
      if (!n) return [];
      var s = ((r = {})[J] = "", r[$e] = ae, r.dangerouslySetInnerHTML = { __html: n }, r), o = Qe();
      return o && (s.nonce = o), [x.createElement("style", R({}, s, { key: "sc-0-0" }))];
    }, this.seal = function() {
      t.sealed = !0;
    }, this.instance = new ue({ isServer: !0 }), this.sealed = !1;
  }
  return e.prototype.collectStyles = function(t) {
    if (this.sealed) throw T(2);
    return x.createElement(Jr, { sheet: this.instance }, t);
  }, e.prototype.interleaveWithNodeStream = function(t) {
    throw T(3);
  }, e;
})(), pn = { StyleSheet: ue, mainSheet: Vt };
export {
  hn as ServerStyleSheet,
  nn as StyleSheetConsumer,
  ft as StyleSheetContext,
  Jr as StyleSheetManager,
  sn as ThemeConsumer,
  ne as ThemeContext,
  an as ThemeProvider,
  pn as __PRIVATE__,
  cn as createGlobalStyle,
  ht as css,
  Xr as default,
  ct as isStyledComponent,
  un as keyframes,
  Xr as styled,
  on as useTheme,
  ae as version,
  fn as withTheme
};
