/* Java context completion for LeetCode practice. Offline, no JDT. */
(function (root, factory) {
  const library = typeof module === 'object' && module.exports ? require('./java-library.js') : root.JavaLibrary;
  const api = factory(library);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JavaComplete = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (library) {
  'use strict';

  function m(name, params, returnType, doc) {
    return { name, kind: 'method', params, returnType, doc };
  }

  function f(name, returnType, doc) {
    return { name, kind: 'field', params: [], returnType, doc };
  }

  const LIST_METHODS = [
    m('add', ['E e'], 'boolean', '在末尾追加元素'),
    m('add', ['int index', 'E element'], 'void', '在指定位置插入元素'),
    m('get', ['int index'], 'E', '返回指定位置的元素'),
    m('set', ['int index', 'E element'], 'E', '替换指定位置的元素'),
    m('remove', ['int index'], 'E', '删除指定位置的元素'),
    m('remove', ['Object o'], 'boolean', '删除首次出现的指定元素'),
    m('size', [], 'int', '返回元素个数'),
    m('isEmpty', [], 'boolean', '判断是否为空'),
    m('contains', ['Object o'], 'boolean', '是否包含指定元素'),
    m('indexOf', ['Object o'], 'int', '返回首次出现的索引'),
    m('lastIndexOf', ['Object o'], 'int', '返回最后出现的索引'),
    m('clear', [], 'void', '清空所有元素'),
    m('toArray', [], 'Object[]', '转为数组'),
    m('subList', ['int fromIndex', 'int toIndex'], 'List', '返回子列表视图'),
  ];

  const MAP_METHODS = [
    m('put', ['K key', 'V value'], 'V', '放入键值对'),
    m('get', ['Object key'], 'V', '按键取值'),
    m('getOrDefault', ['Object key', 'V defaultValue'], 'V', '取值或返回默认值'),
    m('containsKey', ['Object key'], 'boolean', '是否包含键'),
    m('containsValue', ['Object value'], 'boolean', '是否包含值'),
    m('remove', ['Object key'], 'V', '按键删除'),
    m('size', [], 'int', '返回键值对数量'),
    m('isEmpty', [], 'boolean', '判断是否为空'),
    m('clear', [], 'void', '清空映射'),
    m('keySet', [], 'Set', '返回键集合'),
    m('values', [], 'Collection', '返回值集合'),
    m('entrySet', [], 'Set', '返回键值对集合'),
    m('putIfAbsent', ['K key', 'V value'], 'V', '键不存在时放入'),
  ];

  const SET_METHODS = [
    m('add', ['E e'], 'boolean', '添加元素'),
    m('remove', ['Object o'], 'boolean', '删除元素'),
    m('contains', ['Object o'], 'boolean', '是否包含元素'),
    m('size', [], 'int', '返回元素个数'),
    m('isEmpty', [], 'boolean', '判断是否为空'),
    m('clear', [], 'void', '清空集合'),
    m('toArray', [], 'Object[]', '转为数组'),
  ];

  const QUEUE_METHODS = [
    m('offer', ['E e'], 'boolean', '入队, 失败返回 false'),
    m('poll', [], 'E', '出队并返回队首, 空则 null'),
    m('peek', [], 'E', '查看队首, 空则 null'),
    m('add', ['E e'], 'boolean', '入队, 失败抛异常'),
    m('remove', [], 'E', '出队, 空则抛异常'),
    m('size', [], 'int', '返回元素个数'),
    m('isEmpty', [], 'boolean', '判断是否为空'),
    m('clear', [], 'void', '清空队列'),
  ];

  const DEQUE_METHODS = [
    ...QUEUE_METHODS,
    m('offerFirst', ['E e'], 'boolean', '插入到队首'),
    m('offerLast', ['E e'], 'boolean', '插入到队尾'),
    m('pollFirst', [], 'E', '移除并返回队首'),
    m('pollLast', [], 'E', '移除并返回队尾'),
    m('peekFirst', [], 'E', '查看队首'),
    m('peekLast', [], 'E', '查看队尾'),
    m('addFirst', ['E e'], 'void', '插入到队首'),
    m('addLast', ['E e'], 'void', '插入到队尾'),
    m('removeFirst', [], 'E', '移除队首'),
    m('removeLast', [], 'E', '移除队尾'),
    m('getFirst', [], 'E', '获取队首'),
    m('getLast', [], 'E', '获取队尾'),
  ];

  const BUILTIN = {
    String: [
      m('length', [], 'int', '返回字符串长度'),
      m('charAt', ['int index'], 'char', '返回指定索引处的字符'),
      m('substring', ['int beginIndex'], 'String', '截取从 beginIndex 到末尾的子串'),
      m('substring', ['int beginIndex', 'int endIndex'], 'String', '截取 [beginIndex, endIndex) 子串'),
      m('indexOf', ['String str'], 'int', '返回子串首次出现的索引'),
      m('indexOf', ['int ch'], 'int', '返回字符首次出现的索引'),
      m('lastIndexOf', ['String str'], 'int', '返回子串最后出现的索引'),
      m('equals', ['Object anObject'], 'boolean', '比较内容是否相等'),
      m('equalsIgnoreCase', ['String anotherString'], 'boolean', '忽略大小写比较'),
      m('compareTo', ['String anotherString'], 'int', '按字典序比较'),
      m('isEmpty', [], 'boolean', '判断是否为空串'),
      m('contains', ['CharSequence s'], 'boolean', '是否包含指定序列'),
      m('startsWith', ['String prefix'], 'boolean', '是否以指定前缀开头'),
      m('endsWith', ['String suffix'], 'boolean', '是否以指定后缀结尾'),
      m('replace', ['char oldChar', 'char newChar'], 'String', '替换所有匹配字符'),
      m('replace', ['CharSequence target', 'CharSequence replacement'], 'String', '替换所有匹配序列'),
      m('split', ['String regex'], 'String[]', '按正则分割'),
      m('trim', [], 'String', '去掉首尾空白'),
      m('toCharArray', [], 'char[]', '转为字符数组'),
      m('toLowerCase', [], 'String', '转为小写'),
      m('toUpperCase', [], 'String', '转为大写'),
    ],

    StringBuilder: [
      m('append', ['String str'], 'StringBuilder', '追加字符串'),
      m('append', ['char c'], 'StringBuilder', '追加字符'),
      m('append', ['int i'], 'StringBuilder', '追加整数'),
      m('toString', [], 'String', '转为 String'),
      m('length', [], 'int', '返回当前长度'),
      m('charAt', ['int index'], 'char', '返回指定索引处的字符'),
      m('setCharAt', ['int index', 'char ch'], 'void', '设置指定位置的字符'),
      m('delete', ['int start', 'int end'], 'StringBuilder', '删除区间字符'),
      m('deleteCharAt', ['int index'], 'StringBuilder', '删除指定位置字符'),
      m('insert', ['int offset', 'String str'], 'StringBuilder', '在指定位置插入'),
      m('reverse', [], 'StringBuilder', '反转字符序列'),
      m('setLength', ['int newLength'], 'void', '设置长度'),
    ],

    StringBuffer: [
      m('append', ['String str'], 'StringBuffer', '追加字符串'),
      m('append', ['char c'], 'StringBuffer', '追加字符'),
      m('toString', [], 'String', '转为 String'),
      m('length', [], 'int', '返回当前长度'),
      m('charAt', ['int index'], 'char', '返回指定索引处的字符'),
      m('delete', ['int start', 'int end'], 'StringBuffer', '删除区间字符'),
      m('reverse', [], 'StringBuffer', '反转字符序列'),
    ],

    Array: [
      f('length', 'int', '数组长度'),
      m('clone', [], 'Object', '浅拷贝数组'),
    ],

    List: LIST_METHODS,
    ArrayList: LIST_METHODS.slice(),
    LinkedList: [
      ...LIST_METHODS,
      m('addFirst', ['E e'], 'void', '插入到链表头部'),
      m('addLast', ['E e'], 'void', '插入到链表尾部'),
      m('removeFirst', [], 'E', '移除并返回头部'),
      m('removeLast', [], 'E', '移除并返回尾部'),
      m('getFirst', [], 'E', '获取头部元素'),
      m('getLast', [], 'E', '获取尾部元素'),
      m('peek', [], 'E', '查看头部, 空则 null'),
      m('poll', [], 'E', '移除头部, 空则 null'),
      m('offer', ['E e'], 'boolean', '在尾部入队'),
    ],

    Map: MAP_METHODS,
    HashMap: MAP_METHODS.slice(),
    Set: SET_METHODS,
    HashSet: SET_METHODS.slice(),
    Queue: QUEUE_METHODS,
    Deque: DEQUE_METHODS,
    ArrayDeque: DEQUE_METHODS.slice(),
    PriorityQueue: QUEUE_METHODS.slice(),

    Arrays: [
      m('sort', ['int[] a'], 'void', '对 int 数组排序'),
      m('sort', ['T[] a'], 'void', '对对象数组排序'),
      m('sort', ['T[] a', 'Comparator<? super T> c'], 'void', '按比较器排序'),
      m('asList', ['T... a'], 'List', '数组转为定长 List'),
      m('binarySearch', ['int[] a', 'int key'], 'int', '二分查找'),
      m('fill', ['int[] a', 'int val'], 'void', '用指定值填充数组'),
      m('copyOf', ['T[] original', 'int newLength'], 'T[]', '复制并调整长度'),
      m('equals', ['int[] a', 'int[] a2'], 'boolean', '比较两个数组是否相等'),
      m('toString', ['int[] a'], 'String', '数组的字符串表示'),
    ],

    Collections: [
      m('sort', ['List<T> list'], 'void', '对 List 自然序排序'),
      m('sort', ['List<T> list', 'Comparator<? super T> c'], 'void', '按比较器排序'),
      m('reverse', ['List<?> list'], 'void', '反转 List'),
      m('swap', ['List<?> list', 'int i', 'int j'], 'void', '交换两个位置'),
      m('max', ['Collection<? extends T> coll'], 'T', '返回最大元素'),
      m('min', ['Collection<? extends T> coll'], 'T', '返回最小元素'),
      m('frequency', ['Collection<?> c', 'Object o'], 'int', '统计元素出现次数'),
      m('binarySearch', ['List<? extends Comparable<? super T>> list', 'T key'], 'int', '二分查找'),
      m('fill', ['List<? super T> list', 'T obj'], 'void', '用指定值填充 List'),
      m('emptyList', [], 'List', '返回空 List'),
      m('singletonList', ['T o'], 'List', '返回单元素 List'),
    ],

    Math: [
      m('max', ['int a', 'int b'], 'int', '返回较大值'),
      m('min', ['int a', 'int b'], 'int', '返回较小值'),
      m('abs', ['int a'], 'int', '返回绝对值'),
      m('sqrt', ['double a'], 'double', '平方根'),
      m('pow', ['double a', 'double b'], 'double', '幂运算'),
      m('ceil', ['double a'], 'double', '向上取整'),
      m('floor', ['double a'], 'double', '向下取整'),
      m('round', ['double a'], 'long', '四舍五入'),
      m('random', [], 'double', '返回 [0.0, 1.0) 随机数'),
      m('log', ['double a'], 'double', '自然对数'),
    ],

    Integer: [
      m('parseInt', ['String s'], 'int', '字符串解析为 int'),
      m('valueOf', ['int i'], 'Integer', '装箱为 Integer'),
      m('valueOf', ['String s'], 'Integer', '字符串转为 Integer'),
      m('intValue', [], 'int', '拆箱为 int'),
      m('compare', ['int x', 'int y'], 'int', '比较两个 int'),
      m('max', ['int a', 'int b'], 'int', '返回较大值'),
      m('min', ['int a', 'int b'], 'int', '返回较小值'),
      m('toString', ['int i'], 'String', 'int 转字符串'),
      m('bitCount', ['int i'], 'int', '统计二进制 1 的个数'),
      m('highestOneBit', ['int i'], 'int', '返回最高位的 1'),
    ],

    Character: [
      m('isLetter', ['char ch'], 'boolean', '是否为字母'),
      m('isDigit', ['char ch'], 'boolean', '是否为数字'),
      m('isLetterOrDigit', ['char ch'], 'boolean', '是否为字母或数字'),
      m('isWhitespace', ['char ch'], 'boolean', '是否为空白字符'),
      m('toLowerCase', ['char ch'], 'char', '转为小写'),
      m('toUpperCase', ['char ch'], 'char', '转为大写'),
      m('isUpperCase', ['char ch'], 'boolean', '是否为大写'),
      m('isLowerCase', ['char ch'], 'boolean', '是否为小写'),
      m('getNumericValue', ['char ch'], 'int', '字符的数值'),
    ],

    Objects: [
      m('equals', ['Object a', 'Object b'], 'boolean', '空安全的 equals'),
      m('hash', ['Object... values'], 'int', '计算组合哈希'),
      m('nonNull', ['Object obj'], 'boolean', '是否非 null'),
      m('isNull', ['Object obj'], 'boolean', '是否为 null'),
      m('requireNonNull', ['T obj'], 'T', '非 null 校验'),
      m('toString', ['Object o'], 'String', '空安全的 toString'),
    ],

    Optional: [
      m('of', ['T value'], 'Optional', '创建非空 Optional'),
      m('ofNullable', ['T value'], 'Optional', '可为 null 的 Optional'),
      m('empty', [], 'Optional', '空 Optional'),
      m('get', [], 'T', '获取值, 空则抛异常'),
      m('isPresent', [], 'boolean', '是否有值'),
      m('isEmpty', [], 'boolean', '是否为空'),
      m('orElse', ['T other'], 'T', '无值时返回默认值'),
      m('orElseThrow', [], 'T', '无值时抛异常'),
      m('map', ['Function mapper'], 'Optional', '映射内部值'),
      m('ifPresent', ['Consumer action'], 'void', '有值时执行动作'),
    ],

    ListNode: [
      f('val', 'int', '节点值'),
      f('next', 'ListNode', '下一节点'),
    ],

    TreeNode: [
      f('val', 'int', '节点值'),
      f('left', 'TreeNode', '左子树'),
      f('right', 'TreeNode', '右子树'),
    ],
  };

  const PRIMITIVES = new Set(['boolean', 'byte', 'char', 'double', 'float', 'int', 'long', 'short', 'void']);
  const MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'default', 'strictfp']);
  const KEYWORDS = ['abstract', 'assert', 'break', 'case', 'catch', 'class', 'continue', 'default', 'do', 'else', 'enum', 'extends', 'final', 'finally', 'for', 'if', 'implements', 'import', 'instanceof', 'interface', 'new', 'package', 'private', 'protected', 'public', 'record', 'return', 'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'try', 'var', 'while', 'true', 'false', 'null', ...PRIMITIVES];
  const BOXED = { int: 'Integer', long: 'Long', double: 'Double', float: 'Float', byte: 'Byte', short: 'Short', char: 'Character', boolean: 'Boolean' };
  const catalog = Object.create(null);
  for (const [name, data] of Object.entries(library || {})) {
    catalog[name] = {
      typeParameters: data.typeParameters,
      members: data.members.map(([memberName, kind, returnType, paramTypes, isStatic]) => {
        const curated = (BUILTIN[name] || []).find(item => item.name === memberName && item.params.length === paramTypes.length && item.params.every((p, i) => p.slice(0, p.lastIndexOf(' ')).replace(/\s/g, '') === paramTypes[i].replace(/\s/g, '')));
        return { name: memberName, kind, returnType, paramTypes, static: isStatic,
          params: paramTypes.map((t, i) => `${t} ${curated ? curated.params[i].split(/\s+/).pop() : `arg${i + 1}`}`),
          doc: curated ? curated.doc : `Java 25 ${name}.${memberName}` };
      }),
    };
  }
  for (const name of ['Array', 'ListNode', 'TreeNode']) {
    catalog[name] = { typeParameters: [], members: BUILTIN[name].map(item => ({ ...item, static: false, paramTypes: [] })) };
  }
  catalog.Pair = { typeParameters: ['K', 'V'], members: [
    { ...m('getKey', [], 'K', '获取键'), paramTypes: [], static: false },
    { ...m('getValue', [], 'V', '获取值'), paramTypes: [], static: false },
    { ...m('Pair', ['K key', 'V value'], 'Pair<K, V>', '创建键值对'), kind: 'constructor', paramTypes: ['K', 'V'], static: false },
  ] };

  // 保留位置和字面量类型, 注释不参与声明分析. 未完成的字符串也能阻止手动补全.
  function lex(source) {
    const tokens = [], ignored = [];
    const re = /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFdDlL]?|\.\.\.|->|::|\S/g;
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) { i++; continue; }
      const start = i;
      if (source.startsWith('//', i) || source.startsWith('/*', i)) {
        const line = source.startsWith('//', i);
        const end = source.indexOf(line ? '\n' : '*/', i + 2);
        i = end < 0 ? source.length : end + (line ? 0 : 2);
        ignored.push({ start, end: i, closed: end >= 0, comment: true });
        continue;
      }
      if (source[i] === '"' || source[i] === "'") {
        const textBlock = source.startsWith('"""', i), quote = textBlock ? '"""' : source[i];
        i += quote.length;
        let closed = false;
        while (i < source.length) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source.startsWith(quote, i)) { i += quote.length; closed = true; break; }
          if (!textBlock && source[i] === '\n') break;
          i++;
        }
        i = Math.min(i, source.length);
        ignored.push({ start, end: i, closed });
        tokens.push({ text: source.slice(start, i), start, end: i, literal: quote === "'" ? 'char' : 'String' });
        continue;
      }
      re.lastIndex = i;
      const match = re.exec(source);
      if (!match) break;
      i = re.lastIndex;
      tokens.push({ text: match[0], start, end: i });
    }
    return { tokens, ignored };
  }

  function splitTokens(tokens, delimiter = ',') {
    const groups = [], stack = [];
    let start = 0;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].text;
      if (['<', '(', '[', '{'].includes(t)) stack.push(t);
      else if (['>', ')', ']', '}'].includes(t)) stack.pop();
      else if (t === delimiter && !stack.length) { groups.push(tokens.slice(start, i)); start = i + 1; }
    }
    groups.push(tokens.slice(start));
    return groups;
  }

  function parseType(tokens, start = 0) {
    let i = start;
    while (tokens[i] && MODIFIERS.has(tokens[i].text)) i++;
    if (!tokens[i] || !/^[A-Za-z_$][\w$]*$/.test(tokens[i].text)) return null;
    let name = tokens[i++].text;
    while (tokens[i]?.text === '.' && /^[A-Za-z_$][\w$]*$/.test(tokens[i + 1]?.text || '')) {
      name += `.${tokens[i + 1].text}`; i += 2;
    }
    name = name.endsWith('Map.Entry') ? 'Map.Entry' : name.split('.').pop();
    const args = [];
    if (tokens[i]?.text === '<') {
      const begin = ++i;
      let depth = 1;
      while (i < tokens.length && depth) {
        if (tokens[i].text === '<') depth++;
        if (tokens[i].text === '>') depth--;
        if (depth) i++;
      }
      if (depth) return null;
      for (let part of splitTokens(tokens.slice(begin, i))) {
        if (!part.length) continue;
        if (part[0]?.text === '?') part = part.slice(['extends', 'super'].includes(part[1]?.text) ? 2 : 1);
        args.push(parseType(part)?.type || { name: 'Object', args: [], dimensions: 0 });
      }
      i++;
    }
    let dimensions = 0;
    while (tokens[i]?.text === '[' && tokens[i + 1]?.text === ']') { dimensions++; i += 2; }
    if (tokens[i]?.text === '...') { dimensions++; i++; }
    return { type: { name, args, dimensions }, next: i };
  }
  function typeRef(raw) { return parseType(lex(raw || 'Object').tokens)?.type || { name: 'Object', args: [], dimensions: 0 }; }
  function typeText(type) { return `${type.name}${type.args.length ? `<${type.args.map(typeText).join(', ')}>` : ''}${'[]'.repeat(type.dimensions)}`; }
  function normalizeType(raw) { const t = typeRef(raw); return t.name === 'var' ? null : t.dimensions ? 'Array' : t.name; }
  function substitute(type, bindings) {
    const replacement = bindings[type.name];
    return replacement ? { ...replacement, dimensions: replacement.dimensions + type.dimensions } : { ...type, args: type.args.map(arg => substitute(arg, bindings)) };
  }

  function analyze(source) {
    const { tokens, ignored } = lex(source), pairs = new Map(), stack = [];
    const scopes = [{ start: 0, end: source.length + 1, parent: null, kind: 'root', symbols: [] }];
    const tokenScopes = [], braceScopes = new Map();
    let scope = scopes[0];
    tokens.forEach((token, i) => {
      tokenScopes[i] = scope;
      if (['(', '[', '{'].includes(token.text)) {
        stack.push(i);
        if (token.text === '{') {
          const child = { start: token.end, end: source.length + 1, parent: scope, kind: 'block', symbols: [] };
          scopes.push(child); braceScopes.set(i, child); scope = child;
        }
      } else if ([')', ']', '}'].includes(token.text)) {
        const open = stack.pop();
        if (open !== undefined) { pairs.set(open, i); pairs.set(i, open); }
        if (token.text === '}' && scope.parent) { scope.end = token.start; scope = scope.parent; }
      }
    });
    const index = { source, tokens, ignored, pairs, scopes, tokenScopes, braceScopes, types: Object.create(null), loops: [] };
    // 先建类索引, 包括还没输入右括号的类.
    tokens.forEach((token, i) => {
      if (!['class', 'interface', 'record', 'enum'].includes(token.text) || !tokens[i + 1]) return;
      const name = tokens[i + 1].text;
      let body = i + 2;
      while (body < tokens.length && !['{', ';'].includes(tokens[body].text)) body++;
      if (tokens[body]?.text !== '{') return;
      const classScope = braceScopes.get(body);
      classScope.kind = 'class'; classScope.name = name;
      const parameters = tokens[i + 2]?.text === '<' ? splitTokens(tokens.slice(i + 3, tokens.findIndex((t, n) => n > i + 2 && t.text === '>'))).map(p => p[0]?.text).filter(Boolean) : [];
      const extendsIndex = tokens.slice(i + 2, body).findIndex(t => t.text === 'extends');
      const parentType = extendsIndex >= 0 ? parseType(tokens, i + 3 + extendsIndex)?.type : null;
      const data = { typeParameters: parameters, members: [], scope: classScope, parentType };
      index.types[name] = data; classScope.data = data;
    });
    const parameterSymbols = new Set();
    function parameters(open, close) {
      return splitTokens(tokens.slice(open + 1, close)).map(part => {
        const parsed = parseType(part);
        if (!parsed || !part[parsed.next]) return null;
        const nameToken = part[parsed.next];
        let type = parsed.type;
        if (part[parsed.next + 1]?.text === '[') type = { ...type, dimensions: type.dimensions + 1 };
        parameterSymbols.add(nameToken.start);
        return { name: nameToken.text, type, position: nameToken.start };
      }).filter(Boolean);
    }
    // 方法声明只读类层, 参数归属方法, 不泄漏到相邻方法.
    tokens.forEach((token, i) => {
      const owner = tokenScopes[i];
      if (owner.kind !== 'class') return;
      const parsed = parseType(tokens, i);
      if (!parsed) return;
      let nameIndex = parsed.next, constructor = false;
      if (tokens[nameIndex]?.text === '(' && parsed.type.name === owner.name) { nameIndex--; constructor = true; }
      if (tokens[nameIndex + 1]?.text !== '(') return;
      const open = nameIndex + 1, close = pairs.get(open);
      if (close === undefined) return;
      let body = close + 1;
      if (tokens[body]?.text === 'throws') { while (body < tokens.length && !['{', ';'].includes(tokens[body].text)) body++; }
      if (!['{', ';'].includes(tokens[body]?.text)) return;
      const params = parameters(open, close);
      const name = tokens[nameIndex].text;
      if (owner.data.members.some(m => m.position === tokens[nameIndex].start)) return;
      const mods = tokens.slice(i, nameIndex).map(t => t.text);
      // 索引可从 modifier 或返回类型开始, static 从整条声明读取.
      let start = i;
      while (start > 0 && MODIFIERS.has(tokens[start - 1].text)) start--;
      const isStatic = tokens.slice(start, nameIndex).some(t => t.text === 'static') || mods.includes('static');
      owner.data.members.push({ name, kind: constructor ? 'constructor' : 'method', returnType: constructor ? owner.name : typeText(parsed.type), paramTypes: params.map(p => typeText(p.type)), params: params.map(p => `${typeText(p.type)} ${p.name}`), static: isStatic, doc: '当前文件中的方法', position: tokens[nameIndex].start });
      const bodyScope = braceScopes.get(body);
      if (bodyScope) {
        bodyScope.kind = 'method'; bodyScope.static = isStatic;
        bodyScope.symbols.push(...params.map(p => ({ ...p, start: bodyScope.start, end: bodyScope.end, kind: 'variable' })));
      }
    });
    // 循环和 catch 的头部变量限于对应语句, 单行循环同样有范围.
    tokens.forEach((token, i) => {
      if (!['for', 'while', 'switch', 'catch', 'do'].includes(token.text)) return;
      let open = i + 1, close = pairs.get(open), body;
      if (token.text === 'do') { close = i; body = i + 1; }
      else if (tokens[open]?.text !== '(' || close === undefined) return;
      else body = close + 1;
      let end = source.length + 1;
      const last = statementEnd(index, body);
      if (last !== null) end = tokens[last]?.end || end;
      index.loops.push({ kind: token.text, start: token.start, end, open, close, body });
      if (token.text === 'catch') {
        const bodyScope = braceScopes.get(body);
        if (bodyScope) bodyScope.symbols.push(...parameters(open, close).map(p => ({ ...p, start: bodyScope.start, end, kind: 'variable' })));
      }
    });
    tokens.forEach((token, i) => {
      if (MODIFIERS.has(token.text) || parameterSymbols.has(token.start)) return;
      const parsed = parseType(tokens, i);
      if (!parsed || (!PRIMITIVES.has(parsed.type.name) && parsed.type.name !== 'var' && !catalog[parsed.type.name] && !index.types[parsed.type.name] && !/^[A-Z]/.test(parsed.type.name))) return;
      const nameToken = tokens[parsed.next];
      if (!nameToken || !/^[A-Za-z_$][\w$]*$/.test(nameToken.text) || parameterSymbols.has(nameToken.start)) return;
      let next = parsed.next + 1, type = parsed.type;
      while (tokens[next]?.text === '[' && tokens[next + 1]?.text === ']') { type = { ...type, dimensions: type.dimensions + 1 }; next += 2; }
      if (!['=', ';', ',', ':'].includes(tokens[next]?.text)) return;
      const owner = tokenScopes[i];
      if (owner.symbols.some(s => s.position === nameToken.start)) return;
      const loop = index.loops.find(l => l.open < i && i < l.close);
      let start = loop ? tokens[loop.open].start : nameToken.end;
      const end = loop ? loop.end : owner.end;
      let staticStart = i;
      while (staticStart > 0 && MODIFIERS.has(tokens[staticStart - 1].text)) staticStart--;
      const isStatic = tokens.slice(staticStart, i).some(t => t.text === 'static');
      const add = (name, position, declaredType, initializer) => {
        const symbol = { name, type: declaredType, position, start, end, kind: owner.kind === 'class' ? 'field' : 'variable', static: isStatic, initializer };
        if (tokens[next]?.text === ':' && loop) symbol.iterableEnd = loop.close - 1;
        owner.symbols.push(symbol);
        if (owner.kind === 'class') owner.data.members.push({ name, kind: 'field', returnType: typeText(declaredType), params: [], paramTypes: [], static: isStatic, doc: '当前文件中的字段', position });
      };
      const initializer = tokens[next]?.text === '=' ? next + 1 : null;
      add(nameToken.text, nameToken.start, type, initializer);
      // int a = 0, b = 1; 中逗号不能与调用参数或泛型参数混淆.
      if (tokens[next]?.text === ':') return;
      for (let j = next + 1; j < tokens.length && ![';', '{', '}'].includes(tokens[j].text); j++) {
        if (pairs.has(j) && pairs.get(j) > j) { j = pairs.get(j); continue; }
        if (tokens[j].text === ',' && /^[A-Za-z_$][\w$]*$/.test(tokens[j + 1]?.text || '') && ['=', ',', ';'].includes(tokens[j + 2]?.text)) {
          add(tokens[j + 1].text, tokens[j + 1].start, type, tokens[j + 2].text === '=' ? j + 3 : null);
        }
      }
    });
    addLambdaSymbols(index);
    return index;
  }

  function statementEnd(index, start) {
    const { tokens, pairs } = index;
    if (!tokens[start]) return null;
    if (tokens[start].text === '{') return pairs.get(start) ?? null;
    if (['if', 'for', 'while', 'switch', 'synchronized'].includes(tokens[start].text)) {
      const close = pairs.get(start + 1);
      if (close === undefined) return null;
      const end = statementEnd(index, close + 1);
      return end !== null && tokens[start].text === 'if' && tokens[end + 1]?.text === 'else' ? statementEnd(index, end + 2) : end;
    }
    for (let i = start; i < tokens.length; i++) {
      if (tokens[i].text === ';') return i;
      if (tokens[i].text === '}') return i - 1;
      if (pairs.has(i) && pairs.get(i) > i) i = pairs.get(i);
    }
    return null;
  }
  function addLambdaSymbols(index) {
    const { tokens, pairs } = index;
    const functionalNames = { Consumer: 'accept', BiConsumer: 'accept', Function: 'apply', BiFunction: 'apply', UnaryOperator: 'apply', BinaryOperator: 'apply', Predicate: 'test', Comparator: 'compare', IntUnaryOperator: 'applyAsInt', IntFunction: 'apply', Runnable: 'run', Supplier: 'get' };
    tokens.forEach((token, arrow) => {
      if (token.text !== '->') return;
      let parameters;
      if (tokens[arrow - 1]?.text === ')') {
        const open = pairs.get(arrow - 1);
        if (open === undefined) return;
        parameters = splitTokens(tokens.slice(open + 1, arrow - 1));
      } else parameters = [[tokens[arrow - 1]]];
      let callOpen = arrow - 1;
      while (callOpen >= 0) {
        if (tokens[callOpen].text === '(' && (pairs.get(callOpen) === undefined || pairs.get(callOpen) > arrow) && callAt(index, callOpen, token.start)?.members.length) break;
        callOpen--;
      }
      const call = callOpen >= 0 ? callAt(index, callOpen, token.start) : null;
      let expected = null;
      if (call) {
        let parameter = 0;
        for (let i = callOpen + 1; i < arrow; i++) {
          if (tokens[i].text === ',') parameter++;
          else if (pairs.has(i) && pairs.get(i) > i && pairs.get(i) < arrow) i = pairs.get(i);
        }
        const args = argumentTypes(index, callOpen, arrow, token.start, 0);
        const member = chooseOverload(call.members.filter(m => functionalNames[typeRef(m.paramTypes[parameter]).name]), args);
        if (member) {
          const functional = substitute(typeRef(member.paramTypes[parameter]), inferBindings(member.paramTypes, args));
          expected = membersFor(functional, index).find(m => m.name === functionalNames[functional.name])?.paramTypes;
        }
      }
      if (!expected) {
        // 函数接口也可能直接赋值给变量, 而非作为另一个方法的参数.
        const target = index.scopes.flatMap(s => s.symbols).filter(s => s.initializer !== null && tokens[s.initializer]?.start < token.start && functionalNames[s.type.name]).sort((a, b) => b.position - a.position).find(s => {
          for (let i = s.initializer; i < arrow; i++) {
            if (tokens[i].text === ';') return false;
            if (pairs.has(i) && pairs.get(i) > i && pairs.get(i) < arrow) i = pairs.get(i);
          }
          return true;
        });
        if (target) expected = membersFor(target.type, index).find(m => m.name === functionalNames[target.type.name])?.paramTypes;
      }
      let end = index.source.length + 1;
      const body = arrow + 1;
      if (tokens[body]?.text === '{') end = tokens[pairs.get(body)]?.end || end;
      else {
        for (let i = body; i < tokens.length; i++) {
          if ([')', ',', ';', '}'].includes(tokens[i].text)) { end = tokens[i].start; break; }
          if (pairs.has(i) && pairs.get(i) > i) i = pairs.get(i);
        }
      }
      const owner = scopeAt(index, token.start);
      parameters.forEach((part, n) => {
        if (!part[0]) return;
        const parsed = parseType(part), explicit = parsed && part[parsed.next];
        const name = explicit ? part[parsed.next].text : part[0].text;
        if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
        owner.symbols.push({ name, type: explicit ? parsed.type : typeRef(expected?.[n]), start: token.end, end, position: part[0].start, kind: 'variable' });
      });
    });
  }
  function scopeAt(index, offset) { return index.scopes.filter(s => s.start <= offset && offset <= s.end).sort((a, b) => b.start - a.start)[0] || index.scopes[0]; }
  function classAt(index, offset) { let s = scopeAt(index, offset); while (s && s.kind !== 'class') s = s.parent; return s; }
  function methodAt(index, offset) { let s = scopeAt(index, offset); while (s && s.kind !== 'method' && s.kind !== 'class') s = s.parent; return s?.kind === 'method' ? s : null; }
  function visibleSymbols(index, offset) {
    const result = new Map(), staticContext = methodAt(index, offset)?.static;
    for (let s = scopeAt(index, offset); s; s = s.parent) {
      const inherited = s.kind === 'class' && s.data.parentType ? membersFor(typeRef(s.name), index).filter(m => m.kind === 'field').map(m => ({ name: m.name, type: typeRef(m.returnType), kind: 'field', static: m.static, start: 0, end: s.end })) : [];
      for (const symbol of [...s.symbols, ...inherited]) {
        if (result.has(symbol.name) || offset > symbol.end || (symbol.kind !== 'field' && offset < symbol.start) || (staticContext && symbol.kind === 'field' && !symbol.static)) continue;
        result.set(symbol.name, symbol);
      }
    }
    return [...result.values()];
  }
  function inIgnored(index, offset) { return index.ignored.some(r => offset > r.start && (offset < r.end || (!r.closed && offset === r.end) || (r.comment && offset === r.end))); }
  function tokenBefore(index, offset) { let i = index.tokens.length - 1; while (i >= 0 && index.tokens[i].end > offset) i--; return i; }
  function bindingsFor(type, data) { return Object.fromEntries((data?.typeParameters || []).map((p, i) => [p, type.args[i] || typeRef('Object')])); }
  function membersFor(type, index, seen = new Set()) {
    if (!type || seen.has(type.name)) return [];
    seen.add(type.name);
    if (type.dimensions) return catalog.Array.members.map(m => m.name === 'clone' ? { ...m, returnType: typeText(type) } : m);
    const data = index.types[type.name] || catalog[type.name];
    if (!data) return [];
    const bindings = bindingsFor(type, data);
    const members = data.members.map(member => ({ ...member,
      returnType: typeText(substitute(typeRef(member.returnType), member.static ? {} : bindings)),
      paramTypes: (member.paramTypes || []).map(p => typeText(substitute(typeRef(p), member.static ? {} : bindings))),
      params: member.params.map((p, i) => `${typeText(substitute(typeRef(member.paramTypes?.[i] || p.slice(0, p.lastIndexOf(' '))), member.static ? {} : bindings))} ${p.split(/\s+/).pop()}`),
    }));
    if (data.parentType) {
      for (const inherited of membersFor(substitute(data.parentType, bindings), index, seen)) {
        if (inherited.kind !== 'constructor' && !members.some(m => memberKey(m) === memberKey(inherited))) members.push(inherited);
      }
    }
    return members;
  }
  function memberKey(m) { return `${m.kind}:${m.name}:${(m.paramTypes || []).join(',')}`; }
  function expression(index, end, offset, depth = 0) {
    if (end < 0 || depth > 24) return null;
    const tokens = index.tokens, token = tokens[end];
    const resolve = n => expression(index, n, offset, depth + 1);
    if (['true', 'false'].includes(token.text)) return { type: typeRef('boolean'), static: false, start: end };
    if (token.literal) return { type: typeRef(token.literal), static: false, start: end };
    if (/^\d/.test(token.text)) return { type: typeRef(/[lL]$/.test(token.text) ? 'long' : /[.fFdD]/.test(token.text) ? 'double' : 'int'), static: false, start: end };
    if (token.text === '}') {
      const open = index.pairs.get(end);
      const array = open === undefined || tokens[open - 1]?.text !== ']' ? null : resolve(open - 1);
      return array?.type.dimensions ? { ...array, arrayCreation: false } : null;
    }
    if (token.text === ']') {
      const open = index.pairs.get(end), receiver = open === undefined ? null : resolve(open - 1);
      if (receiver?.static && tokens[receiver.start - 1]?.text === 'new') return { ...receiver, type: { ...receiver.type, dimensions: 1 }, static: false, arrayCreation: true, start: receiver.start - 1 };
      if (receiver?.arrayCreation) return { ...receiver, type: { ...receiver.type, dimensions: receiver.type.dimensions + 1 }, arrayCreation: true };
      const created = receiver?.type.dimensions ? { ...receiver, type: { ...receiver.type, dimensions: receiver.type.dimensions - 1 }, static: false } : null;
      return created;
    }
    if (token.text === ')') {
      const open = index.pairs.get(end);
      if (open === undefined) return null;
      const call = callAt(index, open, offset, depth + 1);
      if (call && !call.members.length) return null;
      if (call?.members.length) {
        const args = argumentTypes(index, open, end, offset, depth + 1);
        const best = chooseOverload(call.members, args);
        if (!best) return null;
        const bindings = inferBindings(best.originalParamTypes || best.paramTypes, args);
        return { type: substitute(typeRef(best.returnType), bindings), static: false, start: call.start };
      }
      const cast = tokens[open + 1]?.text === '(' ? index.pairs.get(open + 1) : undefined;
      if (cast !== undefined && cast < end - 1) {
        const parsed = parseType(tokens.slice(open + 2, cast));
        if (parsed) return { type: parsed.type, static: false, start: open };
      }
      if (/^[A-Za-z_$][\w$]*$/.test(tokens[open - 1]?.text || '') && !['return', 'throw', 'yield'].includes(tokens[open - 1].text)) return null;
      const enclosed = resolve(end - 1);
      return enclosed ? { ...enclosed, arrayCreation: false } : null; // 括号包裹的表达式.
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(token.text)) return null;
    if (tokens[end - 1]?.text === '.') {
      const receiver = resolve(end - 2);
      if (!receiver) return null;
      if (receiver.static && catalog[`${receiver.type.name}.${token.text}`]) return { type: typeRef(`${receiver.type.name}.${token.text}`), static: true, start: receiver.start };
      const member = membersFor(receiver.type, index).find(m => m.kind === 'field' && m.name === token.text && m.static === receiver.static);
      return member ? { type: typeRef(member.returnType), static: false, start: receiver.start } : null;
    }
    if (token.text === 'this' || token.text === 'super') {
      const cls = classAt(index, offset);
      if (!cls || methodAt(index, offset)?.static) return null;
      return { type: token.text === 'super' ? cls.data.parentType || typeRef('Object') : typeRef(cls.name), static: false, start: end };
    }
    const symbol = visibleSymbols(index, offset).find(s => s.name === token.text);
    if (symbol) {
      let type = symbol.type;
      if (type.name === 'var' && symbol.iterableEnd !== undefined) {
        const iterable = expression(index, symbol.iterableEnd, symbol.position, depth + 1)?.type;
        type = iterable?.dimensions ? { ...iterable, dimensions: iterable.dimensions - 1 } : iterable?.args[0] || typeRef('Object');
      } else if (type.name === 'var' && symbol.initializer !== null) {
        let last = symbol.initializer;
        while (last < tokens.length && ![';', ','].includes(tokens[last].text)) {
          if (index.pairs.has(last) && index.pairs.get(last) > last) last = index.pairs.get(last);
          last++;
        }
        type = expression(index, last - 1, symbol.position, depth + 1)?.type || typeRef('Object');
      }
      return { type, static: false, start: end };
    }
    return catalog[token.text] || index.types[token.text] || PRIMITIVES.has(token.text) ? { type: typeRef(token.text), static: true, start: end } : null;
  }
  function argumentTypes(index, open, end, offset, depth) {
    const args = [];
    let start = open + 1;
    for (let i = start; i <= end; i++) {
      if (i === end || index.tokens[i].text === ',') {
        if (i > start) {
          const arrow = index.tokens.findIndex((t, n) => n >= start && n < i && t.text === '->');
          if (arrow >= 0) {
            let last = i - 1;
            if (index.tokens[last].text === '}') {
              const body = index.pairs.get(last);
              const returns = index.tokens.map((t, n) => t.text === 'return' && n > body && n < last ? n : -1).filter(n => n >= 0);
              if (returns.length) {
                last = returns[0] + 1;
                while (last < i && index.tokens[last].text !== ';') last++;
                last--;
              }
            }
            const result = expression(index, last, index.tokens[last].end, depth + 1)?.type;
            args.push({ ...typeRef('Object'), lambdaReturn: result });
          } else args.push(expression(index, i - 1, offset, depth + 1)?.type || typeRef('Object'));
        }
        start = i + 1;
      } else if (index.pairs.has(i) && index.pairs.get(i) > i) i = index.pairs.get(i);
    }
    return args;
  }
  function inferBindings(params, args) {
    const bindings = {};
    function bind(param, arg) {
      if (!param || !arg) return;
      if (arg.lambdaReturn && ['Function', 'BiFunction', 'UnaryOperator', 'BinaryOperator', 'Supplier', 'IntFunction'].includes(param.name)) { bind(param.args[param.args.length - 1], arg.lambdaReturn); return; }
      if (/^[A-Z]$/.test(param.name)) {
        bindings[param.name] = { ...arg, name: BOXED[arg.name] || arg.name, dimensions: Math.max(0, arg.dimensions - param.dimensions) };
      } else param.args.forEach((p, i) => bind(p, arg.args[i]));
    }
    (params || []).forEach((p, i) => bind(typeRef(p), args[i]));
    return bindings;
  }
  function chooseOverload(members, args) {
    function compatibility(raw, arg) {
      if (!raw) return 0;
      const param = typeRef(raw);
      if (arg.lambdaReturn) return /Function|Operator|Consumer|Predicate|Comparator|Supplier|Runnable/.test(param.name) ? 6 : -4;
      if (arg.name === 'Object') return 0;
      if (param.dimensions !== arg.dimensions) return -8;
      if (param.name === arg.name || param.name === BOXED[arg.name] || BOXED[param.name] === arg.name) return 8;
      if (/^[A-Z]$/.test(param.name)) return 5;
      return param.name === 'Object' ? 1 : -4;
    }
    return members.map(m => ({ m, score: (m.paramTypes.length === args.length ? 20 : -Math.abs(m.paramTypes.length - args.length) * 10) + args.reduce((sum, arg, i) => sum + compatibility(m.paramTypes[i], arg), 0) })).sort((a, b) => b.score - a.score)[0]?.m;
  }
  function callAt(index, open, offset, depth = 0) {
    const tokens = index.tokens;
    let nameIndex = open - 1;
    // new ArrayList<String>(...) 和 new ArrayList<>(...).
    if (tokens[nameIndex]?.text === '>') {
      let level = 1; nameIndex--;
      while (nameIndex >= 0 && level) { if (tokens[nameIndex].text === '>') level++; if (tokens[nameIndex].text === '<') level--; nameIndex--; }
    }
    const name = tokens[nameIndex]?.text;
    if (!/^[A-Za-z_$][\w$]*$/.test(name || '')) return null;
    let newIndex = nameIndex - 1;
    while (tokens[newIndex]?.text === '.' && newIndex > 0) newIndex -= 2;
    if (tokens[newIndex]?.text === 'new') {
      let type = parseType(tokens, newIndex + 1)?.type;
      if (!type) return null;
      if (!type.args.length && tokens[nameIndex + 1]?.text === '<') {
        const target = index.scopes.flatMap(s => s.symbols).find(s => s.initializer === newIndex);
        if (target?.type.args.length) type = { ...type, args: target.type.args };
      }
      const data = index.types[type.name] || catalog[type.name];
      let members = membersFor(type, index).filter(m => m.kind === 'constructor').map(m => ({ ...m, returnType: typeText(type) }));
      if (!members.length && data) members = [{ name: type.name, kind: 'constructor', params: [], paramTypes: [], returnType: typeText(type) }];
      return { members, start: newIndex };
    }
    if (tokens[nameIndex - 1]?.text === '.') {
      const receiver = expression(index, nameIndex - 2, offset, depth + 1);
      if (!receiver) return null;
      // 方法自身的类型变量与接收者的类型变量不同, 保留用于实参推断.
      const members = membersFor(receiver.type, index).filter(m => m.kind === 'method' && m.name === name && m.static === receiver.static);
      return { members, start: receiver.start };
    }
    const cls = classAt(index, offset);
    if (!cls || cls.data.members.some(m => m.position === tokens[nameIndex].start)) return null;
    return { members: membersFor(typeRef(cls.name), index).filter(m => m.kind === 'method' && m.name === name && (!methodAt(index, offset)?.static || m.static)), start: nameIndex };
  }
  function findDotContext(source, offset) {
    const match = source.slice(0, offset).match(/\.\s*([\w$]*)$/);
    return match ? { dotIndex: offset - match[0].length, prefix: match[1] } : null;
  }
  function resolveExpressionType(source, endExclusive) { const index = analyze(source); const receiver = expression(index, tokenBefore(index, endExclusive), endExclusive); return receiver ? receiver.type.dimensions ? 'Array' : receiver.type.name : null; }
  function resolveReceiverType(source, offset) { const ctx = findDotContext(source, offset); return ctx ? resolveExpressionType(source, ctx.dotIndex) : null; }
  function lookupVariableType(source, name, offset) { return visibleSymbols(analyze(source), offset).find(s => s.name === name)?.type.name || null; }
  function scanUserTypes(source) { return Object.fromEntries(Object.entries(analyze(source).types).map(([name, data]) => [name, data.members])); }
  function getMembersForType(name, source = '') { return membersFor(typeRef(name), analyze(source)); }
  function memberSignature(member) { return member.kind === 'method' || member.kind === 'constructor' ? `${member.kind === 'constructor' ? '' : `${member.returnType} `}${member.name}(${member.params.join(', ')})` : `${member.returnType || ''} ${member.name}`.trim(); }
  function memberInsertText(member) {
    if (!['method', 'constructor'].includes(member.kind)) return member.name;
    return `${member.name}(${member.params.map((param, i) => `\${${i + 1}:${param.split(/\s+/).pop()}}`).join(', ')})`;
  }
  function completions(index, offset) {
    if (inIgnored(index, offset)) return [];
    const { source } = index, ctx = findDotContext(source, offset);
    let items;
    if (ctx) {
      const receiver = expression(index, tokenBefore(index, ctx.dotIndex), offset);
      if (!receiver) return [];
      items = membersFor(receiver.type, index).filter(m => m.kind !== 'constructor' && m.static === receiver.static);
      if (receiver.static && receiver.type.name === 'Map') items.push({ name: 'Entry', kind: 'class', returnType: 'Map.Entry', params: [], doc: '映射中的键值对' });
    } else {
      const before = source.slice(0, offset).replace(/[\w$]*$/, ''), constructing = /\bnew\s+$/.test(before);
      if (constructing) {
        items = Object.entries({ ...catalog, ...index.types }).flatMap(([name, data]) => {
          const constructors = data.members.filter(m => m.kind === 'constructor');
          return constructors.length ? constructors : index.types[name] ? [{ name, kind: 'constructor', params: [], paramTypes: [], returnType: name, doc: '当前文件中的类型' }] : [];
        });
      } else {
        const loops = index.loops.filter(l => l.start <= offset && offset <= l.end);
        const method = methodAt(index, offset);
        const keys = KEYWORDS.filter(k => (k !== 'continue' || loops.some(l => ['for', 'while', 'do'].includes(l.kind) && (index.tokens[l.body]?.start || 0) <= offset)) && (k !== 'break' || loops.some(l => ['for', 'while', 'do', 'switch'].includes(l.kind) && (index.tokens[l.body]?.start || 0) <= offset)) && (k !== 'return' || method) && (!['this', 'super'].includes(k) || !method?.static));
        items = keys.map(name => ({ name, kind: 'keyword', params: [], doc: 'Java 关键字' }));
        items.push(...Object.keys({ ...catalog, ...index.types }).filter(n => n !== 'Array').map(name => ({ name, kind: 'class', params: [], doc: index.types[name] ? '当前文件中的类型' : 'Java 25 标准类型' })));
        items.push(...visibleSymbols(index, offset).map(s => ({ name: s.name, kind: s.kind, params: [], returnType: typeText(s.type), doc: s.kind === 'field' ? '当前类中的字段' : '当前作用域的变量或参数' })));
        const cls = classAt(index, offset);
        if (cls) items.push(...membersFor(typeRef(cls.name), index).filter(m => m.kind === 'method' && (!method?.static || m.static)));
      }
    }
    const seen = new Set();
    return items.filter(item => { const key = memberKey(item); if (seen.has(key)) return false; seen.add(key); return true; }).map(member => ({ ...member, signature: memberSignature(member), insertText: memberInsertText(member) }));
  }
  function getCompletions(source, offset) { return completions(analyze(source), offset); }
  function signatureHelp(index, offset) {
    if (inIgnored(index, offset)) return null;
    const tokens = index.tokens;
    for (let i = tokenBefore(index, offset); i >= 0; i--) {
      if (tokens[i].text === ')' || tokens[i].text === ']') { const open = index.pairs.get(i); if (open !== undefined) i = open; continue; }
      if (tokens[i].text === ';' || tokens[i].text === '{' || tokens[i].text === '}') return null;
      if (tokens[i].text !== '(') continue;
      const call = callAt(index, i, offset);
      if (!call?.members.length) continue;
      let parameter = 0;
      const nested = [];
      for (let n = i + 1; n < tokens.length && tokens[n].start < offset; n++) {
        const text = tokens[n].text;
        if (['(', '[', '{'].includes(text) || (text === '<' && (/^[A-Z]/.test(tokens[n - 1]?.text || '') || tokens[n - 1]?.text === '.'))) nested.push(text);
        else if ([')', ']', '}'].includes(text) || (text === '>' && nested[nested.length - 1] === '<')) nested.pop();
        else if (text === ',' && !nested.length) parameter++;
      }
      const signatures = call.members.map(m => ({ ...m, signature: memberSignature(m) }));
      const args = argumentTypes(index, i, tokenBefore(index, offset) + 1, offset, 0);
      const best = chooseOverload(call.members.filter(m => m.paramTypes.length > parameter), args) || call.members[0];
      return { signatures, activeSignature: Math.max(0, call.members.indexOf(best)), activeParameter: parameter };
    }
    return null;
  }
  function getSignatureHelp(source, offset) { return signatureHelp(analyze(source), offset); }

  function register(monaco) {
    if (!monaco?.languages) return;
    const cache = new WeakMap();
    function modelIndex(model) {
      const version = model.getVersionId(), cached = cache.get(model);
      if (cached?.version === version) return cached.index;
      const index = analyze(model.getValue()); cache.set(model, { version, index }); return index;
    }
    const kinds = { keyword: 'Keyword', class: 'Class', variable: 'Variable', field: 'Field', method: 'Method', constructor: 'Constructor' };
    const completion = monaco.languages.registerCompletionItemProvider('java', {
      triggerCharacters: ['.'],
      provideCompletionItems(model, position) {
        const word = model.getWordAtPosition(position), wordUntil = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word?.startColumn || wordUntil.startColumn, endColumn: word?.endColumn || position.column };
        const index = modelIndex(model);
        const wordEnd = model.getOffsetAt({ lineNumber: position.lineNumber, column: range.endColumn });
        const hasArguments = /^\s*\(/.test(index.source.slice(wordEnd));
        return { suggestions: completions(index, model.getOffsetAt(position)).map(item => ({
          label: { label: item.name, detail: ['method', 'constructor'].includes(item.kind) ? `(${item.params.join(', ')})` : '', description: item.kind === 'constructor' ? '' : item.returnType || '' },
          kind: monaco.languages.CompletionItemKind[kinds[item.kind]], insertText: hasArguments && ['method', 'constructor'].includes(item.kind) ? item.name : item.insertText,
          insertTextRules: !hasArguments && ['method', 'constructor'].includes(item.kind) ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
          detail: item.signature, documentation: item.doc, range,
          sortText: `${item.kind === 'variable' ? '0' : item.kind === 'field' ? '1' : item.kind === 'keyword' ? '2' : item.kind === 'method' ? '3' : '4'}_${item.name}_${item.signature}`,
          command: ['method', 'constructor'].includes(item.kind) ? { id: 'editor.action.triggerParameterHints', title: '参数提示' } : undefined,
        })) };
      },
    });
    const signatures = monaco.languages.registerSignatureHelpProvider('java', {
      signatureHelpTriggerCharacters: ['(', ','], signatureHelpRetriggerCharacters: [')'],
      provideSignatureHelp(model, position) {
        const help = signatureHelp(modelIndex(model), model.getOffsetAt(position));
        return help ? { value: { signatures: help.signatures.map(m => ({ label: m.signature, documentation: m.doc, parameters: m.params.map(label => ({ label })) })), activeSignature: help.activeSignature, activeParameter: help.activeParameter }, dispose() {} } : null;
      },
    });
    monaco.languages.setLanguageConfiguration('java', {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] }, brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"', notIn: ['string', 'comment'] }, { open: "'", close: "'", notIn: ['string', 'comment'] }],
      surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
      wordPattern: /[A-Za-z_$][\w$]*/,
      indentationRules: { increaseIndentPattern: /^.*\{[^}"']*$/, decreaseIndentPattern: /^\s*\}/ },
    });
    return { dispose() { completion.dispose(); signatures.dispose(); } };
  }
  return { BUILTIN, resolveReceiverType, resolveExpressionType, findDotContext, getMembersForType, getCompletions, getSignatureHelp, scanUserTypes, normalizeType, lookupVariableType, register };
});
