{ stdenv
, lib
, deno
, fetchDenoDeps
}:
let
  deps = fetchDenoDeps {
    src = ./.;
    mainFile = "server.ts";
    hash = "sha256-FOjL3glnwUoAgtXR593DSc2kW5V3qON5oCsw61GeFgs=";
  };
in

stdenv.mkDerivation {
  pname = "department-of-misinformation";
  version = "0-unstable";

  src = ./.;

  nativeBuildInputs = [ deno deps ];

  buildPhase = ''
    ERROR_OCCURRED=false

    export DENO_DIR="/tmp/deno"
    export DENO_NO_UPDATE_CHECK=true
    export DENO_JOBS=1
    pwd
    ls
    echo startingigngnginin
    ln -s ${deps}/vendor vendor
    ls vendor

    # export LOCKFILE_HASH=$(sha256sum "deno.lock" | cut -d' ' -f1)
    deno run -c 'deno.json' --vendor=true --no-remote server.ts
  '';

  meta = {
    description = "An experimental activitypub server where my infra can post status updates";
    homepage = "https://github.com/zebreus/department-of-misinformation";
    license = lib.licenses.agpl3Only;
    maintainers = with lib.maintainers; [ zebreus ];
    platforms = lib.platforms.linux;
    mainProgram = "department-of-misinformation";
  };
}
