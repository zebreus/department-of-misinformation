{
  description = "An experimental activitypub server where my infra can post statusupdates";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    ,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs
          {
            inherit system;
            overlays = [
              (final: prev:

                import ./fetchDenoDeps.nix { inherit (prev.pkgs) stdenvNoCC deno jq coreutils gnused lib; }
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
