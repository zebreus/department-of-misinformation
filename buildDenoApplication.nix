{
  stdenvNoCC,
  stdenv,
  deno,
  fetchDenoDeps,
  unzip,
  xxd,
  fetchurl,
  util-linux,
  glibc,
  gcc,
  libgcc,
}:
{
  buildDenoApplication =
    {
      pname,
      version,
      src,
      mainFile,
      depsHash ? "",
      denoJson ? "deno.json",
      # Create a temporary directory, where deno can cache some things. Stops deno from whining about not being able to write to the deno directory.
      # Not used if compile is true.
      writableDenoDirectory ? true,
      # Just produce a single binary, instead of a whole directory.
      compile ? false,
      ...
    }@args:
    let
      deps = fetchDenoDeps {
        src = src;
        mainFile = mainFile;
        hash = depsHash;
      };
      executableName = if args ? meta.mainProgram then args.meta.mainProgram else pname;
      denoRuntimeTable = {
        "1.44.4" = {
          x86_64-linux = {
            url = "https://dl.deno.land/release/v1.44.4/denort-x86_64-unknown-linux-gnu.zip";
            hash = "sha256-KdTDshZ5G2f07IaOerSpv6/rNhLTOejADgLW9LOXtYU=";
          };
          aarch64-linux = {
            url = "https://dl.deno.land/release/v1.44.4/denort-aarch64-unknown-linux-gnu.zip";
            hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          };
        };
      };
      architectureToDenoRuntimeZip = {
        x86_64-linux = "denort-x86_64-unknown-linux-gnu.zip";
        aarch64-linux = "denort-aarch64-unknown-linux-gnu.zip";
      };
      denoRuntimeUrl =
        if denoRuntimeTable ? ${deno.version}.${stdenvNoCC.targetPlatform.system} then
          denoRuntimeTable.${deno.version}.${stdenvNoCC.targetPlatform.system}
        else
          {
            url = "https://dl.deno.land/release/v${deno.version}/${
              architectureToDenoRuntimeZip.${stdenvNoCC.targetPlatform.system}
            }";
            hash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          };
      denoRuntime = fetchurl denoRuntimeUrl;
    in
    # deps;
    stdenvNoCC.mkDerivation (
      args
      // {
        nativeBuildInputs =
          [ deno ]
          ++ (
            if compile then
              [
                unzip
                xxd
                util-linux
                glibc
              ]
            else
              [ ]
          )
          ++ (if args ? nativeBuildInputs then args.nativeBuildInputs else [ ]);

        buildPhase = ''
          if test -z '${mainFile}' ; then
            echo "error: You need to specify a mainFile. It is probably something like 'main.ts'"
            echo "fix: Adjust you nix code to pass a main file."
            exit 1
          fi

          if ! test -f '${mainFile}' ; then
            echo "error: The mainFile '${mainFile}' for your application does not exist."
            echo "fix: Run 'echo \"console.log(\\\"Hello world!\\\")\" > ${mainFile}' to create it."
            exit 1
          fi

          if ! test -f "${denoJson}" ; then
            if test "${denoJson}" = "deno.json" ; then
              echo "error: There is no deno config file in your project. For now we need every project to have a config file."
              echo "fix: Run 'deno init' to create it."
            else
              echo "error: The deno config file at '${denoJson}' you specified does not exist."
              echo "fix: Create '${denoJson}'."
            fi
            exit 1
          fi

          if test -e "./vendor" || test -e "./node_modules" ; then
            ls -a
            echo "error: It looks like your project already contains some vendored dependencies. Good job, nice reproducibility. However buildDenoApplication doesnt support it for now." >&2
            echo "fix: Add support for vendored dependencies to buildDenoApplication and submit a patch" >&2
            echo "fix: Or just remove ./vendor and ./node_modules" >&2
            exit 1
          fi

          BUILD_DIR=$(mktemp -d)
          ln -s ${deps}/node_modules $BUILD_DIR/node_modules
          ln -s ${deps}/vendor $BUILD_DIR/vendor
          for file in $(find $src -maxdepth 1 -mindepth 1 -printf "%P\n") ; do
            ln -s $src/$file $BUILD_DIR/$file
          done
        '';

        installPhase =
          if compile then
            ''
              cd $BUILD_DIR
              export DENO_DIR="$(mktemp -d)"
              ln -s ${deps}/deno/npm "$DENO_DIR"
              mkdir -p $DENO_DIR/dl/release/v${deno.version}
              ln -s ${denoRuntime} $DENO_DIR/dl/release/v${deno.version}/denort-x86_64-unknown-linux-gnu.zip

              export DENO_NO_UPDATE_CHECK=true
              export DENO_NO_PACKAGE_JSON=true
              export DENO_JOBS=1
              deno compile --cached-only --vendor=true --node-modules-dir=true -c ${denoJson} -o $out/bin/${executableName} -A ${mainFile}
            ''
          else
            ''
              mkdir -p $out
              mv $BUILD_DIR $out/module

              mkdir -p $out/bin
              cat << EOF > $out/bin/${executableName}
              #!/usr/bin/env bash
              ${
                if writableDenoDirectory then
                  ''
                    export DENO_DIR="\$(mktemp -td ${pname}-XXXXXX)"
                    ln -s ${deps}/deno/npm "\$DENO_DIR"
                  ''
                else
                  ''
                    export DENO_DIR="${deps}/deno"
                  ''
              }
              export DENO_NO_UPDATE_CHECK=true
              export DENO_NO_PACKAGE_JSON=true
              export DENO_JOBS=1
              exec deno run --cached-only --vendor=true --node-modules-dir=true -c $out/module/${denoJson} -A $out/module/${mainFile} "\$@"
              EOF
              chmod a+x $out/bin/${executableName}
            '';

        fixupPhase =
          if compile then
            ''
              # The last 40 bytes of the file have to be the d3n0l4nd trailer
              TRAILER=$(tail -c 40 $out/bin/${executableName} | hexdump -v -e '1/1 "%02x "')
              patchelf --set-interpreter "$(cat ${stdenv.cc}/nix-support/dynamic-linker)" $out/bin/${executableName}
              echo "$TRAILER" | xxd -r -p >>"$out/bin/${executableName}"
            ''
          else
            null;
      }
    );
}
