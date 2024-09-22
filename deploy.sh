#!/bin/sh

set -e;

# if [[ $(git status -s) ]]
# then
#     echo "The working directory is dirty. Please commit any pending changes."
#     exit 1;
# fi

echo "Deleting old publication"
rm -rf public
zola build

# retrieve .git folder from portfolio
git clone git@github.com:PierreZ/portfolio --branch master portfolio --depth 1
mv portfolio/.git public/.git
rm -rf portfolio

cd public

echo "pushing..."
git add --all && git commit -m "(./publish.sh) updating master" && git push origin master && cd ..
echo "done"
