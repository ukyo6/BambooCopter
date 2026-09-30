import java.lang.reflect.*;
import java.util.*;

// 只在更新标准库索引时运行. 安装包使用生成的静态数据, 不需要 JDK.
class JavaLibrary {
    static final String[] CLASSES = {
        "java.lang.Object", "java.lang.String", "java.lang.StringBuilder", "java.lang.StringBuffer",
        "java.lang.CharSequence", "java.lang.Math", "java.lang.StrictMath", "java.lang.System",
        "java.lang.Integer", "java.lang.Long", "java.lang.Double", "java.lang.Float", "java.lang.Short",
        "java.lang.Byte", "java.lang.Boolean", "java.lang.Character", "java.lang.Number",
        "java.lang.Iterable", "java.lang.Comparable", "java.lang.Runnable",
        "java.lang.Exception", "java.lang.RuntimeException", "java.lang.IllegalArgumentException",
        "java.util.Collection", "java.util.List", "java.util.ArrayList", "java.util.LinkedList",
        "java.util.Map", "java.util.Map$Entry", "java.util.HashMap", "java.util.LinkedHashMap",
        "java.util.TreeMap", "java.util.SortedMap", "java.util.NavigableMap", "java.util.Set",
        "java.util.HashSet", "java.util.LinkedHashSet", "java.util.TreeSet", "java.util.SortedSet",
        "java.util.NavigableSet", "java.util.Queue", "java.util.Deque", "java.util.ArrayDeque",
        "java.util.PriorityQueue", "java.util.Stack", "java.util.Vector", "java.util.Iterator",
        "java.util.ListIterator", "java.util.Arrays", "java.util.Collections", "java.util.Comparator",
        "java.util.Objects", "java.util.Optional", "java.util.OptionalInt", "java.util.OptionalLong",
        "java.util.OptionalDouble", "java.util.BitSet", "java.util.Random", "java.util.Scanner",
        "java.util.StringJoiner", "java.util.StringTokenizer", "java.util.AbstractMap$SimpleEntry",
        "java.math.BigInteger", "java.math.BigDecimal", "java.math.RoundingMode",
        "java.util.function.Function", "java.util.function.BiFunction", "java.util.function.Consumer",
        "java.util.function.BiConsumer", "java.util.function.Predicate", "java.util.function.Supplier",
        "java.util.function.IntFunction", "java.util.function.IntUnaryOperator",
        "java.util.function.BinaryOperator", "java.util.function.UnaryOperator",
        "java.util.stream.Stream", "java.util.stream.IntStream", "java.util.stream.LongStream",
        "java.util.stream.DoubleStream", "java.util.stream.Collectors", "java.util.stream.Collector",
        "java.io.PrintStream", "java.util.regex.Pattern", "java.util.regex.Matcher"
    };
    static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
    static String name(Class<?> c) {
        return c == Map.Entry.class ? "Map.Entry" : c.getSimpleName();
    }
    static String type(Type t, Map<TypeVariable<?>, Type> bindings) {
        if (t instanceof Class<?> c) return c.isArray() ? type(c.getComponentType(), bindings) + "[]" : name(c);
        if (t instanceof TypeVariable<?> v) {
            Type bound = bindings.get(v);
            return bound != null && bound != v ? type(bound, bindings) : v.getName();
        }
        if (t instanceof ParameterizedType p) {
            return type(p.getRawType(), bindings) + "<" + String.join(", ", Arrays.stream(p.getActualTypeArguments()).map(a -> type(a, bindings)).toList()) + ">";
        }
        if (t instanceof GenericArrayType a) return type(a.getGenericComponentType(), bindings) + "[]";
        if (t instanceof WildcardType w) {
            if (w.getLowerBounds().length > 0) return "? super " + type(w.getLowerBounds()[0], bindings);
            if (w.getUpperBounds().length > 0 && w.getUpperBounds()[0] != Object.class) return "? extends " + type(w.getUpperBounds()[0], bindings);
            return "?";
        }
        return "Object";
    }
    static Map<TypeVariable<?>, Type> bindings(Class<?> root, Class<?> target, Map<TypeVariable<?>, Type> current) {
        if (root == target) return current;
        List<Type> supers = new ArrayList<>(Arrays.asList(root.getGenericInterfaces()));
        if (root.getGenericSuperclass() != null) supers.add(root.getGenericSuperclass());
        for (Type parent : supers) {
            Class<?> raw = (Class<?>) (parent instanceof ParameterizedType p ? p.getRawType() : parent);
            if (!target.isAssignableFrom(raw)) continue;
            Map<TypeVariable<?>, Type> next = new HashMap<>(current);
            if (parent instanceof ParameterizedType p) {
                TypeVariable<?>[] variables = raw.getTypeParameters();
                Type[] args = p.getActualTypeArguments();
                for (int i = 0; i < args.length; i++) next.put(variables[i], current.getOrDefault(args[i], args[i]));
            }
            return bindings(raw, target, next);
        }
        return current;
    }
    static String member(String name, String kind, String result, Type[] params, boolean isStatic, Map<TypeVariable<?>, Type> bindings) {
        return "[" + q(name) + "," + q(kind) + "," + q(result) + ",[" + String.join(",", Arrays.stream(params).map(t -> q(type(t, bindings))).toList()) + "]," + isStatic + "]";
    }
    public static void main(String[] args) throws Exception {
        if (Runtime.version().feature() != 25) throw new IllegalStateException("Generate with JDK 25");
        System.out.println("/* Generated from OpenJDK 25 public APIs by scripts/JavaLibrary.java. */\n(function(root) {\n  const library = {");
        for (int i = 0; i < CLASSES.length; i++) {
            Class<?> c = Class.forName(CLASSES[i]);
            SortedSet<String> members = new TreeSet<>();
            for (Method m : c.getMethods()) {
                if (m.isBridge() || m.isSynthetic() || m.isAnnotationPresent(Deprecated.class)) continue;
                Map<TypeVariable<?>, Type> b = bindings(c, m.getDeclaringClass(), new HashMap<>());
                members.add(member(m.getName(), "method", type(m.getGenericReturnType(), b), m.getGenericParameterTypes(), Modifier.isStatic(m.getModifiers()), b));
            }
            for (Field f : c.getFields()) {
                if (f.isSynthetic() || f.isAnnotationPresent(Deprecated.class)) continue;
                members.add(member(f.getName(), "field", type(f.getGenericType(), bindings(c, f.getDeclaringClass(), new HashMap<>())), new Type[0], Modifier.isStatic(f.getModifiers()), new HashMap<>()));
            }
            for (Constructor<?> ctor : c.getConstructors()) {
                if (ctor.isSynthetic() || ctor.isAnnotationPresent(Deprecated.class)) continue;
                members.add(member(name(c), "constructor", name(c), ctor.getGenericParameterTypes(), false, new HashMap<>()));
            }
            String variables = String.join(",", Arrays.stream(c.getTypeParameters()).map(v -> q(v.getName())).toList());
            System.out.println("    " + q(name(c)) + ": {typeParameters:[" + variables + "], members:[\n      " + String.join(",\n      ", members) + "\n    ]}" + (i + 1 < CLASSES.length ? "," : ""));
        }
        System.out.println("  };\n  if (typeof module === 'object' && module.exports) module.exports = library;\n  root.JavaLibrary = library;\n})(typeof globalThis !== 'undefined' ? globalThis : this);");
    }
}
