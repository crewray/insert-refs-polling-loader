const { parseComponent } = require("vue-template-compiler");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
const fs = require("fs");

module.exports = function (source) {
  try {
    const parsed = parseComponent(source);
    const _this = this;
    let modified = false; // 标记是否有修改
    if (parsed.script) {
      const scriptContent = parsed.script.content;

      // 解析脚本内容为 AST
      const ast = babelParser.parse(scriptContent, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
        attachComment: true, // 保留注释
      });



      // 使用 Set 来标记已经处理过的节点，防止重复处理
      const visited = new Set();

      // 遍历 AST，查找并修改 this.$refs 使用语句
      traverse(ast, {
        MemberExpression(path) {
          if (
            (t.isThisExpression(path.node.object) || t.isIdentifier(path.node.object)) &&
            t.isIdentifier(path.node.property, { name: "$refs" }) &&
            (t.isMemberExpression(path.parent) || t.isOptionalMemberExpression(path.parent))
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
              const fullRefPath = t.isMemberExpression(path.parentPath.parent) ? generate(path.parentPath.parent).code : "true";

              const timestamp = new Date().getTime();

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

              modified = true;
              
            }
          }
        },
      });
      if (modified) {
        // 生成修改后的脚本内容
        const { code } = generate(ast, {
          retainLines: true, // 保持行号
          compact: false, // 不压缩
          comments: true, // 保留注释
        });

        // 将处理后的脚本内容替换到源代码中
        const scriptRegex = /(<script[^>]*>)([\s\S]*?)(<\/script>)/i;
        const modifiedSource = source.replace(scriptRegex, (match, p1, p2, p3) => {
          return `${p1}\n${code}\n${p3}`;
        });
        fs.appendFileSync("console.log", modifiedSource, "utf8");
        console.log(_this.resourcePath, "完成$refs轮询插入");
        return modifiedSource;
      }
    }
  } catch (error) {
    console.log(this.resourcePath, error);
  }

  return source;
};
