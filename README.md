# insert-refs-polling-loader

小程序分包异步化获取不到$refs解决方案


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

