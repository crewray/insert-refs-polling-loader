# insert-refs-polling-loader

A Webpack loader to handle `this.$refs` usage in Vue components.

## Installation

```sh
npm install insert-refs-polling-loader --save-dev
```
## Usage
```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: [
          'insert-refs-polling-loader'
        ]
      }
    ]
  }
};
```

