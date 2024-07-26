const { parseComponent } = require("vue-template-compiler");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
// const fs = require("fs");

module.exports = function (source) {
  const parsed = parseComponent(source);

  if (parsed.script) {
    const scriptContent = parsed.script.content;

    // 解析脚本内容为 AST
    const ast = babelParser.parse(scriptContent, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    // 使用 Set 来标记已经处理过的节点，防止重复处理
    const visited = new Set();

    // 遍历 AST，查找并修改 this.$refs 使用语句
    traverse(ast, {
      MemberExpression(path) {
        if (
          (t.isThisExpression(path.node.object) || t.isIdentifier(path.node.object)) &&
          t.isIdentifier(path.node.property, { name: "$refs" }) &&
          (t.isMemberExpression(path.parent) || t.isOptionalMemberExpression(path.parent)) &&
          t.isMemberExpression(path.parentPath.parent) &&
          t.isMemberExpression(path.parentPath.parent)
        ) {
          // 修改函数为异步函数
          const functionPath = path.getFunctionParent();
          if (functionPath && !functionPath.node.async) {
            functionPath.node.async = true;
          }

          const parentPath = path.findParent((p) => p.isBlockStatement());
          if (parentPath && !visited.has(parentPath)) {
            visited.add(parentPath); // 标记节点为已访问
            const refs = generate(path.node).code;
            const refPath = generate(path.parentPath.node).code;
            const fullRefPath = generate(path.parentPath.parent).code;
            const timestamp = new Date().getTime();
            const timeout = 5 * 1000;

            // 创建轮询代码
            const pollingCode = `
              let resolveF_${timestamp};
              let promise_${timestamp} = new Promise((resolve, reject) => {
                resolveF_${timestamp} = resolve;
              });
              let countdown = 5 * 1000;
              let timer_${timestamp} = setInterval(() => {
                countdown -= 200;
                if ((${refPath} && ${fullRefPath}) || countdown <= 0) {
                  clearInterval(timer_${timestamp});
                  console.log("countdown",countdown);
                  resolveF_${timestamp}();
                }
              }, 200);
              await promise_${timestamp};
            `;

            // 创建 AST 节点
            const pollingNodes = babelParser.parse(pollingCode, {
              sourceType: "module",
            }).program.body;

            // 在 this.$refs 使用语句前插入轮询代码
            parentPath.node.body.unshift(...pollingNodes);
          }
        }
      },
    });

    // 生成修改后的脚本内容
    const { code } = generate(ast);

    // 将处理后的脚本内容替换到源代码中
    const modifiedSource = source.replace(scriptContent, code);
    // fs.appendFileSync("console.log", modifiedSource, "utf8");

    return modifiedSource;
  }

  return source;
};
