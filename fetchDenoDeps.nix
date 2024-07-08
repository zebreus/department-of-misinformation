{ stdenvNoCC
, lib
, deno
, jq
, gnused
, coreutils
, ...
}:
{
  fetchDenoDeps =
    { name ? "deno-deps"
    , hash ? ""
    , mainFile
    , denoJson ? "deno.json"
    , src
    , ...
    } @ args:
    stdenvNoCC.mkDerivation ({
      inherit name src;

      nativeBuildInputs = [ deno jq gnused coreutils ];

      # run the same build as our main derivation to ensure we capture the correct set of dependencies
      buildPhase = ''
        ERROR_OCCURRED=false

        export DENO_DIR="/tmp/deno"
        export DENO_NO_UPDATE_CHECK=true
        export DENO_JOBS=1

        if test -z '${mainFile}' ; then
          echo "error: You need to specify a mainFile. It is probably something like 'main.ts'"
          echo "fix: Adjust you nix code to pass a main file."
          exit 1
        fi

        if ! test -f '${mainFile}' ; then
          echo "error: The mainFile '${mainFile}' for your application does not exist."
          echo "fix: Run 'echo \"console.log(\\\"Hello world!\\\")\" > ${mainFile}' to create it."
          ERROR_OCCURRED=true
        fi

        if ! test -f "${denoJson}" ; then
          if test "${denoJson}" = "deno.json" ; then
            echo "error: There is no deno config file in your project. For now we need every project to have a config file."
            echo "fix: Run 'deno init' to create it."
          else
            echo "error: The deno config file at '${denoJson}' you specified does not exist."
            echo "fix: Create '${denoJson}'."
          fi
          ERROR_OCCURRED=true
        fi

        LOCKFILE="$((jq -r '.lock' '${denoJson}' || true) | sed -E 's/^(null)?$/deno.lock/')"
        if test -z "$LOCKFILE" ; then
          LOCKFILE="deno.lock"
        fi

        if ! test -f "$LOCKFILE" ; then
          echo "error: Your lockfile '$LOCKFILE' does not seem to exist."
          echo "fix: Run 'deno run --reload ${mainFile}' to create it."
          ERROR_OCCURRED=true
        fi

        if test "$ERROR_OCCURRED" = "true" ; then
          exit 1
        fi

        export LOCKFILE_HASH=$(sha256sum "$LOCKFILE" | cut -d' ' -f1)
        deno cache -c '${denoJson}' --vendor=true ${mainFile}
        LOCKFILE_HASH_AFTER=$(sha256sum "$LOCKFILE" | cut -d' ' -f1)

        if test "$LOCKFILE_HASH" != "$LOCKFILE_HASH_AFTER" ; then
          echo "error: Your lockfile changed while running 'deno cache ${mainFile}'. We cant do reproducible builds this way. You probably have unlocked imports somewhere in your code. To fix this run 'deno cache ${mainFile}' and commit the changed lockfile." >&2
          echo "fix: Run 'deno cache ${mainFile}' and commit the changed lockfile." >&2
          ERROR_OCCURRED=true
        fi

        if test -f vendor/manifest.json ; then
          for import in $(cat vendor/manifest.json | jq -r '.modules | keys[]') ; do
            warning="$(cat vendor/manifest.json | jq -r '.modules["'"$import"'"].headers["x-deno-warning"]' || true)"
            echo "error: Import of '$import' produced a warning. This usually means, that your import is not locked. While this does not always affect reproducibility, it significantly increases the chance of weird errors if we allowed this. You don't like weird bugs, do you? For this reason I am now aborting your build and forcing you to fix it." >&2
            echo "reference: $warning" >&2
            echo "fix: Add the import to your '"'${denoJson}'"' file and lock it by running 'deno add \"$import\"'" >&2
            ERROR_OCCURRED=true
          done
        fi

        if test "$ERROR_OCCURRED" = "true" ; then
          exit 1
        fi
      '';

      installPhase = ''
        mkdir -p $out
        mv vendor $out
        echo "$LOCKFILE_HASH" | cut -d' ' -f1 > $out/lockfile.hash
      '';

      # specify the content hash of this derivations output
      outputHashMode = "recursive";
    } // (if hash != "" then {
      outputHash = hash;
    } else {
      outputHash = "";
      outputHashAlgo = "sha256";
    }));
}
