#!/usr/bin/env node
/* Offline checks for Java completion type resolution. */
const path = require('path');
const JavaComplete = require(path.join(__dirname, '..', 'renderer', 'java-complete.js'));

function names(source, offset) {
  return JavaComplete.getCompletions(source, offset).map((item) => item.name);
}

function offsetAfter(source, needle) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`missing needle: ${needle}`);
  return index + needle.length;
}

function assertIncludes(label, got, expected) {
  const missing = expected.filter((name) => !got.includes(name));
  if (missing.length) {
    throw new Error(`${label}: missing ${missing.join(', ')}; got ${got.join(', ') || '(none)'}`);
  }
  console.log(`PASS ${label}`);
  console.log(`  type → members: ${got.slice(0, 12).join(', ')}${got.length > 12 ? ', ...' : ''}`);
}

function assertEmpty(label, got) {
  if (got.length) throw new Error(`${label}: expected no completions, got ${got.join(', ')}`);
  console.log(`PASS ${label} (no suggestions)`);
}

function main() {
  {
    const source = 'String x = "hi".';
    const offset = offsetAfter(source, '"hi".');
    const type = JavaComplete.resolveReceiverType(source, offset);
    const got = names(source, offset);
    if (type !== 'String') throw new Error(`"hi". type=${type}`);
    assertIncludes('"hi". → String', got, ['length', 'charAt', 'substring']);
  }

  {
    const source = 'class A {\n  void f() {\n    String s = "a";\n    s.\n  }\n}\n';
    const offset = offsetAfter(source, 's.');
    const type = JavaComplete.resolveReceiverType(source, offset);
    if (type !== 'String') throw new Error(`s. type=${type}`);
    assertIncludes('String s; s. → String', names(source, offset), ['length', 'charAt', 'substring']);
  }

  {
    const source = 'class A {\n  void f() {\n    List<Integer> list = null;\n    list.\n  }\n}\n';
    const offset = offsetAfter(source, 'list.');
    const type = JavaComplete.resolveReceiverType(source, offset);
    if (type !== 'List') throw new Error(`list. type=${type}`);
    assertIncludes('List<Integer> list; list. → List', names(source, offset), ['add', 'get', 'size']);
  }

  {
    const source = 'class A {\n  void f(int[] nums) {\n    nums.\n  }\n}\n';
    const offset = offsetAfter(source, 'nums.');
    const type = JavaComplete.resolveReceiverType(source, offset);
    if (type !== 'Array') throw new Error(`nums. type=${type}`);
    assertIncludes('int[] nums; nums. → Array', names(source, offset), ['length']);
  }

  {
    const source = 'class A {\n  void f() {\n    Arrays.\n  }\n}\n';
    const offset = offsetAfter(source, 'Arrays.');
    const type = JavaComplete.resolveReceiverType(source, offset);
    if (type !== 'Arrays') throw new Error(`Arrays. type=${type}`);
    assertIncludes('Arrays. → static', names(source, offset), ['sort', 'asList']);
  }

  {
    const source = [
      'class Foo {',
      '  void bar() {}',
      '  void use() {',
      '    Foo foo = new Foo();',
      '    foo.',
      '  }',
      '}',
    ].join('\n');
    const offset = offsetAfter(source, 'foo.');
    const type = JavaComplete.resolveReceiverType(source, offset);
    if (type !== 'Foo') throw new Error(`foo. type=${type}`);
    const got = names(source, offset);
    assertIncludes('Foo foo; foo. → bar', got, ['bar']);
    if (got.includes('foo')) throw new Error('local variable foo should not appear as Foo member');
    if (!got.includes('use')) throw new Error('expected method use on Foo');
  }

  {
    const source = 'class A {\n  void f() {\n    unknown.\n  }\n}\n';
    const offset = offsetAfter(source, 'unknown.');
    assertEmpty('unknown. → no suggestions', names(source, offset));
  }

  {
    const source = 'class A {\n  void f() {\n    Map<String, Integer> map = new HashMap<>();\n    map.\n  }\n}\n';
    const offset = offsetAfter(source, 'map.');
    if (JavaComplete.resolveReceiverType(source, offset) !== 'Map') throw new Error('map type');
    assertIncludes('Map map; map. → Map', names(source, offset), ['put', 'get', 'containsKey']);
  }

  {
    const source = 'class A {\n  void f() {\n    ListNode node = null;\n    node.\n  }\n}\n';
    const offset = offsetAfter(source, 'node.');
    if (JavaComplete.resolveReceiverType(source, offset) !== 'ListNode') throw new Error('ListNode type');
    assertIncludes('ListNode node; node. → fields', names(source, offset), ['val', 'next']);
  }

  console.log('\nOriginal checks passed.');
}

main();

// 使用光标标记覆盖未完成代码, 防止只在完整类里验证补全.
const assert = require('node:assert/strict');
let regressionCount = 0;
function check(label, code, inspect) {
  const offset = code.indexOf('|');
  assert.ok(offset >= 0, 'missing cursor');
  const source = code.replace('|', '');
  inspect(JavaComplete.getCompletions(source, offset), source, offset);
  regressionCount++;
  console.log(`PASS ${label}`);
}
function includes(...expected) {
  return (items) => expected.forEach(name => assert.ok(items.some(item => item.name === name), `missing ${name}`));
}
function excludes(...unexpected) {
  return (items) => unexpected.forEach(name => assert.ok(!items.some(item => item.name === name), `unexpected ${name}`));
}
check('循环里的 continue', 'class Solution { void f(int[] nums) { for (int n : nums) { cont|', includes('continue'));
check('循环外不提示 continue', 'class Solution { void f() { cont|', excludes('continue'));
check('局部变量和参数', 'class Solution { void f(int[] nums) { int count = 0; cou|', includes('count', 'nums'));
check('类字段在声明前可见', 'class Solution { void f() { cou| } int count; }', includes('count'));
check('同文件方法', 'class Solution { int helper(int n) { return n; } void f() { hel|', includes('helper'));
check('不泄漏另一个方法的变量', 'class A { void f() { String s; } void g() { s.| } }', items => assert.equal(items.length, 0));
check('关闭块不泄漏变量', 'class A { void f() { { String s; } s.| } }', items => assert.equal(items.length, 0));
check('内层同名变量', 'class A { void f() { String value; { List<Integer> value; value.| } } }', includes('add', 'get'));
check('for 变量不泄漏', 'class A { void f() { for (String s : words) {} s.| } }', items => assert.equal(items.length, 0));
check('泛型 get 链式调用', 'class A { void f(List<String> list) { list.get(0).| } }', includes('substring'));
check('嵌套泛型', 'class A { void f(Map<String, List<String>> map) { map.get("x").get(0).| } }', includes('charAt'));
check('字段链', 'class A { void f(ListNode node) { node.next.| } }', includes('val', 'next'));
check('数组元素', 'class A { void f(String[] words) { words[0].| } }', includes('substring'));
check('二维数组', 'class A { void f(int[][] nums) { nums[0].| } }', includes('length'));
check('var 推断', 'class A { void f() { var text = new StringBuilder(); text.| } }', includes('append'));
check('字符串方法链', 'class A { void f(String s) { s.substring(1).trim().| } }', includes('charAt'));
check('数组返回值', 'class A { void f(String s) { s.toCharArray().| } }', includes('length'));
check('静态访问过滤实例方法', 'String.|', items => { includes('valueOf', 'format')(items); excludes('length', 'charAt')(items); });
check('实例不混入静态方法', 'String s; s.|', excludes('valueOf', 'format'));
check('未关闭类', 'class Foo { int count; void use() { Foo foo; foo.|', includes('count', 'use'));
check('同参数数量的重载', 'class Foo { int run(int n) {} String run(String s) {} void use() { this.| } }', items => assert.equal(items.filter(x => x.name === 'run').length, 2));
check('普通类型提示', 'class A { void f() { Hash|', includes('HashMap', 'HashSet'));
check('构造方法提示', 'class A { void f() { List<String> list = new ArrayL|', includes('ArrayList'));
check('中文说明保留', 'List<Integer> list; list.|', items => assert.match(items.find(x => x.name === 'get').doc, /元素/));
check('Map 入口泛型', 'Map<String, Integer> map; map.entrySet().iterator().next().getKey().|', includes('substring'));
check('标准库更多方法', 'Map<String, Integer> map; map.|', includes('computeIfAbsent', 'merge', 'replaceAll'));
check('System.out', 'System.out.|', includes('println', 'printf'));
check('静态工厂泛型', 'List.of("x").get(0).|', includes('substring'));
check('注释不提示', 'class A { // cont|', items => assert.equal(items.length, 0));
check('块注释不提示', 'class A { /* list.|', items => assert.equal(items.length, 0));
check('字符串不提示', 'String s = "list.|";', items => assert.equal(items.length, 0));
check('字符不提示', "char c = 'a|';", items => assert.equal(items.length, 0));
check('text block 不提示', 'String s = """\nlist.|\n""";', items => assert.equal(items.length, 0));
check('关键字不会自动加分号', 'class A { void f() { while(true) { cont|', items => assert.equal(items.find(x => x.name === 'continue').insertText, 'continue'));
check('参数提示和重载', 'class A { void f(String s) { s.substring(1, |); } }', (items, source, offset) => {
  const help = JavaComplete.getSignatureHelp(source, offset);
  assert.equal(help.activeParameter, 1);
  assert.ok(help.signatures.some(x => x.params.length === 2));
});
check('嵌套调用参数索引', 'Math.max(Math.min(1, 2), |)', (items, source, offset) => assert.equal(JavaComplete.getSignatureHelp(source, offset).activeParameter, 1));
check('没有调用时不提示参数', 'class A { void f() { | } }', (items, source, offset) => assert.equal(JavaComplete.getSignatureHelp(source, offset), null));
check('继承方法返回值', 'class Parent { String text(){} } class Child extends Parent { void f(){ text().| } }', includes('substring'));
check('强制转换', 'Object value; ((String) value).|', includes('substring'));
check('new 数组', 'new String[2].|', includes('length'));
check('Lambda 参数类型', 'List<String> words; words.forEach(s -> s.|);', includes('substring'));
check('比较器 Lambda', 'String[] words; Arrays.sort(words, (a, b) -> a.|);', includes('substring'));
check('Lambda 变量不泄漏', 'List<String> words; words.forEach(s -> s.length()); s.|', items => assert.equal(items.length, 0));
check('多变量声明', 'class A { void f(){ String first = "", second = ""; second.| } }', includes('substring'));
check('声明前不提示变量', 'class A { void f(){ later.| String later; } }', items => assert.equal(items.length, 0));
check('this 与静态上下文', 'class A { static void f(){ th| } }', excludes('this'));
check('静态方法不提示实例字段', 'class A { int count; static void f(){ cou| } }', excludes('count'));
check('同名泛型参数类型', 'class Box<T> { T value; } class A { void f(Box<String> box){ box.value.| } }', includes('substring'));
check('循环条件不提示 continue', 'class A { void f(){ while (cont|) {} } }', excludes('continue'));
check('方法声明不弹调用参数提示', 'class A { void f(int |n) {} }', (items, source, offset) => assert.equal(JavaComplete.getSignatureHelp(source, offset), null));

// 同时检查 Monaco 的接入契约, 覆盖范围、插入文本和资源释放.
let provider, signatureProvider, disposed = 0;
const registration = JavaComplete.register({ languages: {
  CompletionItemKind: { Keyword: 1, Class: 2, Variable: 3, Field: 4, Method: 5, Constructor: 6 },
  CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
  registerCompletionItemProvider(language, value) { assert.equal(language, 'java'); provider = value; return { dispose() { disposed++; } }; },
  registerSignatureHelpProvider(language, value) { assert.equal(language, 'java'); signatureProvider = value; return { dispose() { disposed++; } }; },
  setLanguageConfiguration(language, value) { assert.equal(language, 'java'); assert.ok(value.comments.lineComment); },
} });
function modelAt(code) {
  const offset = code.indexOf('|'), source = code.replace('|', '');
  const before = source.slice(0, offset), lineNumber = before.split('\n').length, column = before.split('\n').pop().length + 1;
  const wordBefore = before.match(/[\w$]*$/)[0], wordAfter = source.slice(offset).match(/^[\w$]*/)[0];
  return { position: { lineNumber, column }, model: {
    getValue: () => source, getVersionId: () => 1,
    getOffsetAt: pos => source.split('\n').slice(0, pos.lineNumber - 1).reduce((n, line) => n + line.length + 1, 0) + pos.column - 1,
    getWordAtPosition: () => ({ startColumn: column - wordBefore.length, endColumn: column + wordAfter.length }),
    getWordUntilPosition: () => ({ startColumn: column - wordBefore.length }),
  } };
}
{
  const { model, position } = modelAt('class A { void f(String s){ s.sub|string(1, 2); } }');
  const item = provider.provideCompletionItems(model, position).suggestions.find(x => x.label.label === 'substring');
  assert.equal(item.insertText, 'substring');
  assert.equal(item.range.endColumn - item.range.startColumn, 'substring'.length);
  assert.equal(item.insertTextRules, undefined);
}
{
  const { model, position } = modelAt('class A { void f(String s){ s.sub| } }');
  const item = provider.provideCompletionItems(model, position).suggestions.find(x => x.label.label === 'substring');
  assert.ok(item.insertText.includes('${1:beginIndex}'));
  assert.equal(item.command.id, 'editor.action.triggerParameterHints');
}
{
  const { model, position } = modelAt('String s; s.substring(1, |);');
  const help = signatureProvider.provideSignatureHelp(model, position);
  assert.equal(help.value.activeParameter, 1);
  assert.ok(help.value.signatures.some(x => x.parameters.length === 2));
}
registration.dispose(); assert.equal(disposed, 2);
check('toArray 的泛型重载', 'List<String> words; words.toArray(new String[0])[0].|', includes('substring'));

check('diamond 比较器参数', 'class A { void f(){ PriorityQueue<ListNode> q = new PriorityQueue<>((a,b) -> a.|); } }', includes('val', 'next'));
check('独立 Comparator 参数', 'class A { void f(){ Comparator<String> comp = (a,b) -> a.|; } }', includes('substring'));
check('独立 Function 参数', 'Function<String,Integer> f = s -> s.|;', includes('substring'));
check('数组初始化器推断', 'class A { void f(){ var a = new String[]{"x"}; a[0].| } }', includes('substring'));
check('继承类的隐式字段', 'class Parent { String value; } class A extends Parent { void f(){ value.| } }', includes('substring'));
check('单语句 for 不泄漏变量', 'class A { void f(List<String> list){ for(String s:list) if(s.isEmpty()) {} s.| } }', items => assert.equal(items.length, 0));
check('for var 元素类型', 'List<String> words; for(var s: words) { s.| }', includes('substring'));
check('未知调用无返回类型', 'class A { void f(String s){ unknown(s).| } }', items => assert.equal(items.length, 0));
check('未知成员调用无返回类型', 'class A { void f(String s){ s.unknown(s).| } }', items => assert.equal(items.length, 0));
check('Lambda 参数逗号不影响外层签名', 'String[] a; Arrays.sort(a, (x, |y) -> x.compareTo(y));', (items, source, offset) => assert.equal(JavaComplete.getSignatureHelp(source, offset).activeParameter, 1));
check('泛型逗号不影响外层签名', 'Map<String,Integer> map; map.putAll(new HashMap<String, |Integer>());', (items, source, offset) => assert.equal(JavaComplete.getSignatureHelp(source, offset).activeParameter, 0));
check('boolean 静态工厂', 'List.of(true).get(0).|', includes('booleanValue'));
check('Stream map 返回类型', 'List<String> words; words.stream().map(s -> s.trim()).findFirst().get().|', includes('substring'));
check('Stream map 装箱返回类型', 'List<String> words; words.stream().map(s -> s.length()).findFirst().get().|', includes('intValue'));
console.log(`\nAll ${9 + regressionCount} completion scenarios and Monaco provider checks passed.`);
