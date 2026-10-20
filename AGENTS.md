# Git 提交

提交说明使用简洁英文, 并且以一个类型前缀开头.

```
[feature] add chat empty placeholder
[bugfix] keep boot blades level while spinning
[docs] add git commit message rules
```

前缀只使用下面这几个:

- `[feature]`: 新功能或用户能感知的行为变化.
- `[bugfix]`: 修复错误行为.
- `[refactor]`: 调整内部实现, 不改变外部行为.
- `[docs]`: 只改文档.
- `[test]`: 只改测试.
- `[other]`: 版本号, 构建, 依赖或其他无法归入上面几类的变更.

一条提交只选一个前缀. 前缀后面用一句简短的英文说明做了什么, 不用中文, 不写多段说明.

# 本地 APP 验证

- 每次完成项目修改后, 必须运行 `pnpm dist` 重新打包本地 macOS APP, 并使用本次打包产物验证改动.
- 核对打包命令成功退出、产物版本正确, 以及本次修改已包含在 APP 包内. 涉及界面或交互时, 启动本次打包的 APP 检查实际效果.
- 静态检查、源码运行和旧版本 APP 不能代替本地打包验证. 打包或运行验证未完成时, 交付说明必须明确实际结果和未验证项.
