{
  description = "blog";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    loveit = {
      url = "github:PierreZ/LoveIt/custom";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, flake-utils, loveit }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.hugo ];
          shellHook = ''
            mkdir -p themes
            ln -sf ${loveit} themes/LoveIt
          '';
        };
      });
}