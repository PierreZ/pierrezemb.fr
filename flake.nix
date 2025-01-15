{
  description = "blog";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    loveit = {
      url = "git+https://codeberg.org/alanpearce/zola-bearblog.git";
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
          buildInputs = [ pkgs.git pkgs.zola ];
          shellHook = ''
            mkdir -p themes
            ln -sfF ${loveit} themes/zola-bearblog
          '';
        };
      });
}