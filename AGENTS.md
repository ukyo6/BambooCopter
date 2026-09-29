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
