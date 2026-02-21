
static char string[] = "Hello world";

struct Nested
{
  int z;
  char text[5];
  int list[3];
  struct Ref *ref;
};

struct Ref
{
  int prop;
  float pi;
  char *greeting;
};

struct SomeStruct
{
  int a;
  unsigned short b;
  int c;
  struct Nested child;
  int k;
  struct Ref *ref;
};

static struct Ref ref = {
    .prop = 420,
    .pi = 3.1415,
    .greeting = string,
};

static struct Ref ref2 = {
    .prop = 42,
    .pi = 6.2831,
    .greeting = string,
};

static struct SomeStruct ret = {
    .a = 1,
    .b = 2,
    .c = 5,
    .child = {
        .z = 6,
        .text = {'a', 'b', 'c', '\0'},
        .list = {3, 2, 1},
        .ref = &ref,
    },
    .k = 69,
    .ref = &ref,
};

/// gcc -shared -fPIC -o libtest.dylib *.c

struct SomeStruct *getStruct()
{
  return &ret;
}

struct Ref *getOtherRefPtr()
{
  return &ref2;
}
