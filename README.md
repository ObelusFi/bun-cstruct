# @obelusfi/bun-cstruct

A small convenience layer over `bun:ffi` for working with C structs using TypeScript classes and decorators.

It lets you describe C memory layouts declaratively and access native memory through strongly typed class instances — without manually calculating offsets.

This library exists as a practical solution while waiting for an official Bun API for structured C memory access.

## Features

- Declarative struct definitions via decorators
- Deterministic C-compatible memory layout
- Nested inline structs
- Pointer-backed struct references
- Fixed-size arrays
- Fixed-size inline strings
- C string (`char*`) support
- Enumerable fields (works with `Object.keys`)
- JSON serialization support
- Manual struct allocation

## Installation

```bash
bun add @obelusfi/bun-cstruct
```

add

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
  },
}
```

to your `compilerOptions` in `tsconfig.json`

## Basic Usage

### Define Structs

```ts
import {
  CStruct,
  i32,
  u16,
  f32,
  chars,
  array,
  struct,
  ref,
  refPointer,
  string,
} from "@obelusfi/bun-cstruct";

import type { Pointer } from "bun:ffi";

class Ref extends CStruct {
  @i32 prop!: number;
  @f32 pi!: number;
  @string greeting!: string; // char*
}

class Nested extends CStruct {
  @i32 z!: number;
  @chars(5) text!: string; // inline char[5]
  @array(i32, 3) list!: number[]; // inline int[3]
  @ref(Ref) someReference!: Ref; // Ref*
}

class SomeStruct extends CStruct {
  @i32 a!: number;
  @u16 b!: number;
  @struct(Nested) child!: Nested; // inline struct
  @ref(Ref) someReference!: Ref; // Ref*

  // Pointer to the ref is available via `$` prefix
  @refPointer $someReference!: Pointer;
}
```

### Load a Native Library

```ts
import { dlopen, type Pointer } from "bun:ffi";

const { symbols: lib, close } = dlopen("./libexample.dylib", {
  doSomethingWithStruct: {
    args: ["pointer"],
  },
  getStruct: {
    returns: "pointer",
  },
});
```

### Use a Struct

```ts
const ptr: Pointer = lib.getStruct();
const s = new SomeStruct(ptr);

console.log(s.a); // read from native memory
s.a = 10; // write to native memory

console.log(s.child.z); // nested struct
console.log(s.child.list[0]); // inline array

s.child.text = "hello world"; // safely truncated
```

### Allocate a Struct

The static method `alloc(): Pointer` allows you to allocate memory for a struct using its computed size.

```ts
const ptr: Pointer = SomeStruct.alloc();
lib.doSomethingWithStruct(ptr);
```

### Get size of struct

Extending `CStruct` adds a static prop `size` to your class

```ts
SomeStruct.size; // in bytes
```

## Supported Field Decorators

### Primitives

- `@i8`
- `@i16`
- `@i32`
- `@i64`
- `@u8`
- `@u16`
- `@u32`
- `@u64`
- `@f32`
- `@f64`
- `@intptr`
- `@ptr`

### Inline Fixed-Size String

```ts
{
  // ...
  @chars(10) name!: string;
  // ...
}
```

- Stored as `char[10]`
- Truncates safely on overflow

### C String (`char*`)

```ts
{
  // ....
  @string label!: string;
  // ....
}
```

- Reads/writes null-terminated strings via pointer
- ⚠️ Writes do **not** free the overwritten pointer (memory management is your responsibility)

### Inline Array

```ts
{
  //...
  @array(i32, 4) values!: number[];
  //...
}
```

- Fixed-length
- Safe truncation on assignment
- Writable by index or full replacement

### Inline Struct

```ts
{
  //...
  @struct(OtherStruct) child!: OtherStruct;
  //...
}
```

Equivalent to:

```c
struct Parent {
  struct OtherStruct child;
};
```

### Struct Pointer

```ts
{
  //...
  @ref(OtherStruct) ref!: OtherStruct;
  //...
}
```

Equivalent to:

```c
struct Parent {
  struct OtherStruct* ref;
};
```

Multiple references to the same pointer share memory.

### Raw Pointer Access

When using `@ref(...)`, you can access the underlying pointer via `$yourKey`.

The decorator `@refPointer` is a pass-through helper. It improves type checking and validates that you are referencing an existing `@ref` field.

```ts
{
  //...
  @ref(OtherStruct) ref!: OtherStruct;
  @refPointer $ref!: Pointer;
  //...
}
```

## Memory Layout

- Field order defines memory order.
- Layout matches C struct layout expectations.
- Nested structs are inlined.
- `@ref()` fields store pointers.
- Arrays and fixed strings reserve fixed space.
- Offsets are computed once at class definition time.
- Packed structs are not supported.

## Performance

This library is a convenience abstraction.

- Field access uses getters/setters.
- There is function call overhead.
- It is not zero-cost.
- It is not faster than manual pointer math.

The overhead is usually negligible compared to:

- FFI boundary crossings
- Native library calls
- IO operations

If you are writing extremely tight loops where every nanosecond matters, raw buffer access may be more appropriate.

## What This Library Is

- A structured way to describe C memory layouts
- A safer alternative to manual offset math
- A developer-friendly wrapper around `bun:ffi`
- A stopgap solution until Bun provides official struct support

## License

MIT
