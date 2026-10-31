cmake_minimum_required(VERSION 3.22)

add_compile_options(-fdiagnostics-color=always)

# esp-dl 3.3.14 was built against ESP-IDF 5.5+ (MALLOC_CAP_SIMD landed in 5.5).
# On 5.4 the symbol is undeclared, so define it as 0 — the bitwise-OR becomes
# a no-op and allocation falls back to MALLOC_CAP_DEFAULT. Drop this once we
# move to IDF 5.5+.
add_compile_definitions(MALLOC_CAP_SIMD=0)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(hydra)
