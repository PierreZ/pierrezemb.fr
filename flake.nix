{
  description = "blog";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    zola-quorum-schematics = {
      url = "github:PierreZ/zola-quorum-schematics/5af57f4";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, flake-utils, zola-quorum-schematics }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.git pkgs.zola ];
          shellHook = ''
            mkdir -p themes
            # -n so an existing symlink is replaced rather than dereferenced into.
            ln -sfn ${zola-quorum-schematics} themes/zola-quorum-schematics
          '';
        };
      });
}