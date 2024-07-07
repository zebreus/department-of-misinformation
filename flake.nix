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
        pkgs = import nixpkgs { inherit system; };
      in
      {
        name = "department-of-misinformation";
        packages.default = pkgs.callPackage (
          {
            stdenv,
            lib,
            deno,
          }:
          stdenv.mkDerivation {
            pname = "department-of-misinformation";
            version = "0-unstable";

            src = ./.;

            nativeBuildInputs = [ deno ];

            meta = {
              description = "An experimental activitypub server where my infra can post status updates";
              homepage = "https://github.com/zebreus/department-of-misinformation";
              license = lib.licenses.agpl3Only;
              maintainers = with lib.maintainers; [ zebreus ];
              platforms = lib.platforms.linux;
              mainProgram = "department-of-misinformation";
            };
          }
        ) { };

        formatter = nixpkgs.legacyPackages.x86_64-linux.nixfmt-rfc-style;
      }
    );
}
