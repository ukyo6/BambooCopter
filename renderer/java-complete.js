/* Java member completion for LeetCode Hot 100 practice. Offline, no JDT. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JavaComplete = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  const TYPE_NAME_ACCESS = new Set([
    'Arrays', 'Collections', 'Math', 'Integer', 'Character', 'Objects', 'Optional', 'String',
  ]);

  const KNOWN_TYPES = new Set(Object.keys(BUILTIN));

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripCommentsAndStrings(source) {
    let out = '';
    let i = 0;
    while (i < source.length) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === '/' && next === '/') {
        out += '  ';
        i += 2;
        while (i < source.length && source[i] !== '\n') {
          out += ' ';
          i += 1;
        }
        continue;
      }
      if (ch === '/' && next === '*') {
        out += '  ';
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
          out += source[i] === '\n' ? '\n' : ' ';
          i += 1;
        }
        if (i < source.length) {
          out += '  ';
          i += 2;
        }
        continue;
      }
      if (ch === '"') {
        out += '"';
        i += 1;
        while (i < source.length && source[i] !== '"') {
          if (source[i] === '\\' && i + 1 < source.length) {
            out += '  ';
            i += 2;
            continue;
          }
          out += source[i] === '\n' ? '\n' : ' ';
          i += 1;
        }
        if (i < source.length) {
          out += '"';
          i += 1;
        }
        continue;
      }
      if (ch === '\'') {
        out += '\'';
        i += 1;
        while (i < source.length && source[i] !== '\'') {
          if (source[i] === '\\' && i + 1 < source.length) {
            out += '  ';
            i += 2;
            continue;
          }
          out += ' ';
          i += 1;
        }
        if (i < source.length) {
          out += '\'';
          i += 1;
        }
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  }

  function matchBrackets(source, openIndex, openCh, closeCh) {
    let depth = 0;
    for (let i = openIndex; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === openCh) depth += 1;
      else if (ch === closeCh) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function findMatchingOpen(source, closeIndex, openCh, closeCh) {
    let depth = 0;
    for (let i = closeIndex; i >= 0; i -= 1) {
      const ch = source[i];
      if (ch === closeCh) depth += 1;
      else if (ch === openCh) {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function skipWsLeft(source, index) {
    let i = index;
    while (i >= 0 && /\s/.test(source[i])) i -= 1;
    return i;
  }

  function readIdentLeft(source, index) {
    let i = index;
    if (i < 0 || !/[\w$]/.test(source[i])) return null;
    while (i >= 0 && /[\w$]/.test(source[i])) i -= 1;
    return { name: source.slice(i + 1, index + 1), start: i + 1, end: index + 1 };
  }

  function normalizeType(raw) {
    if (!raw) return null;
    let type = raw.trim().replace(/\s+/g, ' ');
    type = type.replace(/\b(?:public|private|protected|static|final|volatile|transient|synchronized)\b/g, ' ');
    type = type.replace(/\s+/g, ' ').trim();
    if (!type) return null;
    if (/\[\s*\]/.test(type)) return 'Array';
    type = type.replace(/<[^<>]*>/g, '');
    while (/<[^<>]*>/.test(type)) type = type.replace(/<[^<>]*>/g, '');
    type = type.replace(/\s+/g, ' ').trim();
    const parts = type.split(/\s+/);
    type = parts[parts.length - 1];
    if (!type || !/^[\w$]+$/.test(type)) return null;
    if (type === 'var') return null;
    return type;
  }

  function scanUserTypes(source) {
    const cleaned = stripCommentsAndStrings(source);
    const types = Object.create(null);
    const classRe = /\b(?:class|interface)\s+(\w+)\b/g;
    let match;
    while ((match = classRe.exec(cleaned)) !== null) {
      const name = match[1];
      const braceStart = cleaned.indexOf('{', match.index + match[0].length);
      if (braceStart < 0) continue;
      const braceEnd = matchBrackets(cleaned, braceStart, '{', '}');
      if (braceEnd < 0) continue;
      const body = cleaned.slice(braceStart + 1, braceEnd);
      types[name] = scanClassMembers(body);
    }
    return types;
  }

  function scanClassMembers(body) {
    const members = [];
    const seen = new Set();
    // Only read declarations at class-body depth 0, so locals inside methods are ignored.
    let depth = 0;
    let i = 0;
    while (i < body.length) {
      const ch = body[i];
      if (ch === '{') {
        depth += 1;
        i += 1;
        continue;
      }
      if (ch === '}') {
        depth -= 1;
        i += 1;
        continue;
      }
      if (depth !== 0) {
        i += 1;
        continue;
      }

      const slice = body.slice(i);
      const methodMatch = slice.match(/^(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:final\s+)?([\w$]+(?:\s*<[^;{}()]*>)?(?:\s*\[\s*\])*)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[^{;]+)?\s*\{/);
      if (methodMatch) {
        const returnType = normalizeType(methodMatch[1]);
        const name = methodMatch[2];
        if (returnType && !/^(if|for|while|switch|catch)$/.test(name)) {
          const params = methodMatch[3].split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
            const bits = part.replace(/<.*>/, '').trim().split(/\s+/);
            return bits[bits.length - 1] || part.trim();
          });
          const key = `m:${name}:${params.length}`;
          if (!seen.has(key)) {
            seen.add(key);
            members.push({
              name,
              kind: 'method',
              params,
              returnType,
              doc: '当前文件中的方法',
            });
          }
        }
        i += methodMatch[0].length - 1; // leave '{' for depth tracking
        continue;
      }

      const fieldMatch = slice.match(/^(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:final\s+)?([\w$]+(?:\s*<[^;{}()]*>)?(?:\s*\[\s*\])*)\s+(\w+)\s*(?:=|;)/);
      if (fieldMatch) {
        const type = normalizeType(fieldMatch[1]);
        const name = fieldMatch[2];
        if (type && name && !/^(class|return|new)$/.test(name)) {
          const key = `f:${name}`;
          if (!seen.has(key)) {
            seen.add(key);
            members.push({
              name,
              kind: 'field',
              params: [],
              returnType: type,
              doc: '当前文件中的字段',
            });
          }
        }
        i += fieldMatch[0].length;
        continue;
      }

      i += 1;
    }
    return members;
  }

  function lookupVariableType(source, varName, beforeOffset) {
    const cleaned = stripCommentsAndStrings(source.slice(0, beforeOffset));
    const re = new RegExp(
      String.raw`(?:^|[^.\w$])((?:[\w$]+)(?:\s*<[^;{}()]*>)?(?:\s*\[\s*\])*)\s+${escapeRegExp(varName)}\s*(?:=|;|,|\)|:|\{)`,
      'g',
    );
    let match;
    let last = null;
    while ((match = re.exec(cleaned)) !== null) {
      const type = normalizeType(match[1]);
      if (!type || type === varName) continue;
      last = type;
    }
    return last;
  }

  function resolveNewType(source, closeParenIndex) {
    const open = findMatchingOpen(source, closeParenIndex, '(', ')');
    if (open < 0) return null;
    let i = skipWsLeft(source, open - 1);
    if (i >= 0 && source[i] === '>') {
      const openAngle = findMatchingOpen(source, i, '<', '>');
      if (openAngle < 0) return null;
      i = skipWsLeft(source, openAngle - 1);
    }
    const ident = readIdentLeft(source, i);
    if (!ident) return null;
    i = skipWsLeft(source, ident.start - 1);
    const newIdent = readIdentLeft(source, i);
    if (!newIdent || newIdent.name !== 'new') return null;
    return normalizeType(ident.name);
  }

  function findDotContext(source, offset) {
    let i = offset - 1;
    while (i >= 0 && /[\w$]/.test(source[i])) i -= 1;
    if (i < 0 || source[i] !== '.') return null;
    return {
      dotIndex: i,
      prefix: source.slice(i + 1, offset),
    };
  }

  function resolveExpressionType(source, endExclusive) {
    const cleaned = stripCommentsAndStrings(source);
    let i = skipWsLeft(cleaned, endExclusive - 1);
    if (i < 0) return null;

    if (cleaned[i] === '"') return 'String';

    if (cleaned[i] === ')') {
      const newType = resolveNewType(cleaned, i);
      if (newType) return newType;
      return null;
    }

    if (cleaned[i] === ']') return null;

    const ident = readIdentLeft(cleaned, i);
    if (!ident) return null;

    const varType = lookupVariableType(cleaned, ident.name, endExclusive);
    if (varType) return varType;

    if (TYPE_NAME_ACCESS.has(ident.name) || KNOWN_TYPES.has(ident.name)) {
      return ident.name;
    }

    const userTypes = scanUserTypes(cleaned);
    if (userTypes[ident.name]) return ident.name;

    return null;
  }

  function resolveReceiverType(source, offset) {
    const ctx = findDotContext(source, offset);
    if (!ctx) return null;
    return resolveExpressionType(source, ctx.dotIndex);
  }

  function getMembersForType(typeName, source) {
    if (!typeName) return [];
    const userTypes = source ? scanUserTypes(source) : Object.create(null);
    if (userTypes[typeName] && userTypes[typeName].length) {
      return userTypes[typeName].slice();
    }
    if (BUILTIN[typeName]) return BUILTIN[typeName].slice();
    return [];
  }

  function memberSignature(member) {
    if (member.kind === 'field') return `${member.returnType} ${member.name}`;
    return `${member.returnType} ${member.name}(${(member.params || []).join(', ')})`;
  }

  function memberInsertText(member) {
    if (member.kind === 'field') return member.name;
    const params = member.params || [];
    if (!params.length) return `${member.name}()`;
    const snippets = params.map((param, index) => {
      const name = String(param).trim().replace(/\.\.\./g, '').split(/\s+/).pop() || `arg${index + 1}`;
      return `\${${index + 1}:${name}}`;
    });
    return `${member.name}(${snippets.join(', ')})`;
  }

  function getCompletions(source, offset) {
    const type = resolveReceiverType(source, offset);
    if (!type) return [];
    return getMembersForType(type, source).map((member) => ({
      ...member,
      type,
      signature: memberSignature(member),
      insertText: memberInsertText(member),
    }));
  }

  function register(monaco) {
    if (!monaco || !monaco.languages) return;
    monaco.languages.registerCompletionItemProvider('java', {
      triggerCharacters: ['.'],
      provideCompletionItems(model, position) {
        const offset = model.getOffsetAt(position);
        const source = model.getValue();
        const items = getCompletions(source, offset);
        const ctx = findDotContext(source, offset);
        const range = ctx
          ? {
              startLineNumber: position.lineNumber,
              startColumn: position.column - ctx.prefix.length,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            }
          : undefined;
        return {
          suggestions: items.map((item) => ({
            label: item.name,
            kind: item.kind === 'field'
              ? monaco.languages.CompletionItemKind.Field
              : monaco.languages.CompletionItemKind.Method,
            insertText: item.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: item.signature,
            documentation: item.doc,
            sortText: `${item.kind === 'field' ? '0' : '1'}_${item.name}`,
            range,
          })),
        };
      },
    });
  }

  return {
    BUILTIN,
    resolveReceiverType,
    resolveExpressionType,
    findDotContext,
    getMembersForType,
    getCompletions,
    scanUserTypes,
    normalizeType,
    lookupVariableType,
    register,
  };
});
