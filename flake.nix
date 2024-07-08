{
  description = "An experimental activitypub server where my infra can post statusupdates";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (
              final: prev:
              (import ./fetchDenoDeps.nix {
                inherit (final.pkgs)
                  stdenvNoCC
                  deno
                  jq
                  coreutils
                  gnused
                  lib
                  ;
              })
              // (import ./buildDenoApplication.nix { inherit (final.pkgs) stdenvNoCC deno fetchDenoDeps; })
              // {
                deno = prev.deno.overrideAttrs (oldAttrs: {
                  src = final.fetchFromGitHub {
                    owner = "zebreus";
                    repo = "deno";
                    rev = "f67761055b6e3e4346629d06a7ac6028f9d90410";
                    sha256 = "sha256-mlLq6gyoyz+6mnrF86YZ0iBLWXFZ19Qh84MveXG2rfs=";
                  };
                  # cargoDeps = oldAttrs.cargoDeps.overrideAttrs (_: {
                  #   src = final.fetchFromGitHub {
                  #     owner = "zebreus";
                  #     repo = "deno";
                  #     rev = "f67761055b6e3e4346629d06a7ac6028f9d90410";
                  #     sha256 = "sha256-mlLq6gyoyz+6mnrF86YZ0iBLWXFZ19Qh84MveXG2rfs=";
                  #   };
                  #   outputHash = "sha256-tusN/SUZ6uGigFPIy92nZhE6zV9SUFeEVJZFRT0cwVE=";
                  # });
                });
              }
            )
          ];
        };
      in
      {
        name = "department-of-misinformation";
        packages.default = pkgs.callPackage ./default.nix { };

        formatter = nixpkgs.legacyPackages.x86_64-linux.nixfmt-rfc-style;
      }
    );
}
