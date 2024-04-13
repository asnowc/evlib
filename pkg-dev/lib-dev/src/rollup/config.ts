import { rollup, RollupOptions, RollupBuild, OutputOptions } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
export interface BuildConfig {
  output: BuildConfigOutput;
  compress: {
    enable: true;
  };
  typescript: {};
  resolve: {};
}
export interface BuildConfigOutput {}
async function build(opts: RollupOptions) {
  const { output: outputOptions = {} } = opts;

  const output =
    outputOptions instanceof Array ? outputOptions : [outputOptions];

  let bundle: RollupBuild | undefined;
  let buildFailed = false;
  try {
    // 启动一次打包
    bundle = await rollup(opts);

    // 一个文件名数组，表示此产物所依赖的文件
    console.log(bundle.watchFiles);
    for (const opt of output) {
      await bundle.write(opt);
    }
    // await generateOutputs(bundle, output);
  } catch (error) {
    buildFailed = true;
    // 进行一些错误报告
    console.error(error);
  }
  if (bundle) {
    // 关闭打包过程
    await bundle.close();
  }
  process.exit(buildFailed ? 1 : 0);
}

async function generateOutputs(
  bundle: RollupBuild,
  outputOptionList: OutputOptions[],
) {
  for (const outputOptions of outputOptionList) {
    // 生成特定于输出的内存中代码
    // 你可以在同一个 bundle 对象上多次调用此函数
    // 使用 bundle.write 代替 bundle.generate 直接写入磁盘
    const { output } = await bundle.generate(outputOptions);

    for (const chunkOrAsset of output) {
      if (chunkOrAsset.type === "asset") {
        // 对于资源文件，它包含：
        // {
        //   fileName: string,              // 资源文件名
        //   source: string | Uint8Array    // 资源文件内容
        //   type: 'asset'                  // 标志它是一个资源文件
        // }
        console.log("Asset", chunkOrAsset);
      } else {
        // 对于 chunk，它包含以下内容：
        // {
        //   code: string,                  // 生成的 JS 代码
        //   dynamicImports: string[],      // 此 chunk 动态导入的外部模块
        //   exports: string[],             // 导出的变量名
        //   facadeModuleId: string | null, // 与此 chunk 对应的模块的 ID
        //   fileName: string,              // chunk 文件名
        //   implicitlyLoadedBefore: string[]; // 仅在此 chunk 后加载的条目
        //   imports: string[],             // 此 chunk 静态导入的外部模块
        //   importedBindings: {[imported: string]: string[]} // 每个依赖项的导入绑定
        //   isDynamicEntry: boolean,       // 此 chunk 是否为动态入口点
        //   isEntry: boolean,              // 此 chunk 是否为静态入口点
        //   isImplicitEntry: boolean,      // 是否应在其他 chunk 之后仅加载此 chunk
        //   map: string | null,            // 如果存在，则为源映射
        //   modules: {                     // 此 chunk 中模块的信息
        //     [id: string]: {
        //       renderedExports: string[]; // 包含的导出变量名
        //       removedExports: string[];  // 已删除的导出变量名
        //       renderedLength: number;    // 此模块中剩余代码的长度
        //       originalLength: number;    // 此模块中代码的原始长度
        //       code: string | null;       // 此模块中的剩余代码
        //     };
        //   },
        //   name: string                   // 用于命名模式的此 chunk 的名称
        //   preliminaryFileName: string    // 此 chunk 带有哈希占位符的初始文件名
        //   referencedFiles: string[]      // 通过 import.meta.ROLLUP_FILE_URL_<id> 引用的文件
        //   type: 'chunk',                 // 表示这是一个 chunk
        // }
        console.log("Chunk", chunkOrAsset.modules);
      }
    }
  }
}
