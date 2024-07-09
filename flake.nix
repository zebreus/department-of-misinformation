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
        buildDenoApplicationOverlay = (
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
            // (import ./buildDenoApplication.nix {
              inherit (final.pkgs)
                stdenvNoCC
                stdenv
                deno
                fetchDenoDeps
                fetchurl
                xxd
                unzip
                util-linux
                glibc
                libgcc
                gcc
                ;
            })
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
        );
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ buildDenoApplicationOverlay ];
        };
      in
      rec {
        name = "department-of-misinformation";
        packages.department-of-misinformation = pkgs.callPackage ./default.nix { };
        packages.default = packages.department-of-misinformation;

        nixosModules.department-of-misinformation = {
          nixpkgs.overlays = [
            buildDenoApplicationOverlay
            (final: prev: { department-of-misinformation = final.callPackage ./default.nix { }; })
          ];
          imports = [ ./module.nix ];
        };

        formatter = pkgs.nixfmt-rfc-style;
      }
    );
}
