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

  console.log('\nAll checks passed.');
}

main();
