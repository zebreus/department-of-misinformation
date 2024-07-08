{ stdenv
, lib
, deno
, fetchDenoDeps
, fetchurl
, unzip
}:
let
  deps = fetchDenoDeps {
    src = ./.;
    mainFile = "server.ts";
    hash = "sha256-vJONe5c1bRTBUqQmHOqSzSSKQnGx+w2aPwIPn03gBAM=";
  };
  denoRt = fetchurl {
    url = "https://dl.deno.land/release/v${deno.version}/denort-x86_64-unknown-linux-gnu.zip";
    hash = "sha256-KdTDshZ5G2f07IaOerSpv6/rNhLTOejADgLW9LOXtYU=";
  };
in
# deps
stdenv.mkDerivation {
  pname = "department-of-misinformation";
  version = "0-unstable";

  src = ./.;

  nativeBuildInputs = [ deno unzip ];

  buildPhase = ''
    ERROR_OCCURRED=false

    export DENO_DIR="$(pwd)/deno"
    export DENO_NO_UPDATE_CHECK=true
    export DENO_JOBS=1
    pwd
    ls
    echo hi
    echo ${denoRt}
    ls ${denoRt}
    # chmod -R a-w deno
    rm -rf node_modules deno vendor
    mkdir deno
    ln -s ${deps}/deno/npm deno/npm
    mkdir -p deno/dl/release/v${deno.version}
    ln -s ${denoRt} deno/dl/release/v${deno.version}/denort-x86_64-unknown-linux-gnu.zip
    ln -s ${deps}/node_modules node_modules
    ln -s ${deps}/vendor vendor

    # export LOCKFILE_HASH=$(sha256sum "deno.lock" | cut -d' ' -f1)
    deno compile -c 'deno.json' --vendor=true --node-modules-dir=true --cached-only -A helloworld.ts
    ls -a
    ldd ./helloworld
    stat ./helloworld
    ./helloworld
  '';

  installPhase = ''
    mkdir -p $out/bin
    mv helloworld $out/bin
  '';

  meta = {
    description = "An experimental activitypub server where my infra can post status updates";
    homepage = "https://github.com/zebreus/department-of-misinformation";
    license = lib.licenses.agpl3Only;
    maintainers = with lib.maintainers; [ zebreus ];
    platforms = lib.platforms.linux;
    mainProgram = "helloworld";
  };
}
