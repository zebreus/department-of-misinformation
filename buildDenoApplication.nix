{
  stdenvNoCC,
  deno,
  fetchDenoDeps,
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
      writableDenoDirectory ? true,
      ...
    }@args:
    let
      deps = fetchDenoDeps {
        src = src;
        mainFile = mainFile;
        hash = depsHash;
      };
      executableName = if args ? meta.mainProgram then args.meta.mainProgram else pname;
    in
    # deps;
    stdenvNoCC.mkDerivation (
      args
      // {
        nativeBuildInputs = [ deno ] ++ (if args ? nativeBuildInputs then args.nativeBuildInputs else [ ]);

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
            echo "error: It looks like your project already contains some vendored dependencies. Good job, that is good for reproducability. However buildDenoApplication doesnt support it for now." >&2
            echo "fix: Add support for vendored dependencies to buildDenoApplication and submit a patch" >&2
            echo "fix: Or just remove ./vendor and ./node_modules" >&2
            exit 1
          fi
        '';

        installPhase = ''
          mkdir -p $out/module
          for file in $(find $src -maxdepth 1 -mindepth 1 -printf "%P\n") ; do
            cp -raf $src/$file $out/module/$file
          done
          cp -r ${deps}/node_modules $out/module/node_modules
          # ln -s ${deps}/node_modules $out/module/node_modules
          ln -s ${deps}/vendor $out/module/vendor

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
          exec deno run --cached-only --vendor=true --node-modules-dir=true -c $out/module/deno.json -A $out/module/${mainFile} "\$@"
          EOF
          chmod a+x $out/bin/${executableName}
        '';
      }
    );
}
