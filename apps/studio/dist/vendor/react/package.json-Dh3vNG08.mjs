const e = "react", s = "React is a JavaScript library for building user interfaces.", t = ["react"], o = "18.3.1", n = "https://reactjs.org/", r = "https://github.com/facebook/react/issues", m = "MIT", c = ["LICENSE", "README.md", "index.js", "cjs/", "umd/", "jsx-runtime.js", "jsx-dev-runtime.js", "react.shared-subset.js"], a = "index.js", i = { ".": { "react-server": "./react.shared-subset.js", default: "./index.js" }, "./package.json": "./package.json", "./jsx-runtime": "./jsx-runtime.js", "./jsx-dev-runtime": "./jsx-dev-runtime.js" }, d = { type: "git", url: "https://github.com/facebook/react.git", directory: "packages/react" }, j = { node: ">=0.10.0" }, u = { "loose-envify": "^1.1.0" }, p = { transform: ["loose-envify"] }, g = {
  name: e,
  description: s,
  keywords: t,
  version: o,
  homepage: n,
  bugs: r,
  license: "MIT",
  files: c,
  main: a,
  exports: i,
  repository: d,
  engines: j,
  dependencies: u,
  browserify: p
};
export {
  p as browserify,
  r as bugs,
  g as default,
  u as dependencies,
  s as description,
  j as engines,
  i as exports,
  c as files,
  n as homepage,
  t as keywords,
  m as license,
  a as main,
  e as name,
  d as repository,
  o as version
};
