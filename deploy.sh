#!/bin/sh

set -e;

# if [[ $(git status -s) ]]
# then
#     echo "The working directory is dirty. Please commit any pending changes."
#     exit 1;
# fi

echo "Deleting old publication"
rm -rf public
git clone git@github.com:PierreZ/portfolio --branch master public --depth 1
rm -rf public/*
$HOME/Downloads/hugo_extended_0.57.2_Linux-64bit/hugo
cd public 

echo "pushing..."
git add --all && git commit -m "(./publish.sh) updating master" && git push origin master && cd ..
echo "done"