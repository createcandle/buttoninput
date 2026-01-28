#!/bin/bash 

ADDON_ARCH="$1"
#LANGUAGE_NAME="$2"
#PYTHON_VERSION="$3"

set -x # echo commands too

echo
echo

#lsb_release -a
#ldd --version
#echo "python before:"
#python3 --version
#pip3 --version
version=$(grep '"version"' manifest.json | cut -d: -f2 | cut -d\" -f2)
echo
echo
echo "."
echo ".."
echo "package.sh: creating addon version: $version"
echo "package.sh: RELEASE_VERSION from environment?: -->$RELEASE_VERSION<--"

echo "package.sh: runnng on OS:"
uname -a



#set -x

# Setup environment for building inside Dockerized toolchain
[ $(id -u) = 0 ] && umask 0

#apt install libcairo2-dev pkg-config python3-dev

# Clean up from previous releases
echo "package.sh: removing any old files first"
rm -rf *.tgz *.sha256sum package SHA256SUMS lib

if [ -z "${ADDON_ARCH}" ]; then
    TARFILE_SUFFIX=
else
    PYTHON_VERSION="$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d. -f 1-2 | tr -d '\n')"
    TARFILE_SUFFIX="-${ADDON_ARCH}-v${PYTHON_VERSION}"
fi

echo
echo "package.sh: TARFILE_SUFFIX: $TARFILE_SUFFIX"
echo


# Prep new package
echo "package.sh: creating package"
mkdir -p lib package

# Stop if any error occurs
set -e

#python3 -m pip install -r requirements.txt -t lib --no-cache-dir --no-binary :all: --prefix ""
#python$PYTHON_VERSION -m pip install -r requirements.txt -t lib --no-cache-dir --prefix ""
python3 -m pip install -r requirements.txt -t lib --no-cache-dir --prefix ""
#COMMAND="ls -lah"
#bash -c $COMMAND


# Put package together
cp -r lib pkg LICENSE manifest.json *.py README.md css images js views  package/
find package -type f -name '*.pyc' -delete
find package -type f -name '._*' -delete
find package -type d -empty -delete
rm -rf package/pkg/pycache

# Generate checksums
echo "generating checksums"
cd package
find . -type f \! -name SHA256SUMS -exec shasum --algorithm 256 {} \; >> SHA256SUMS
cd -

# Make the tarball
echo "creating archive"
TARFILE="buttoninput-${version}${TARFILE_SUFFIX}.tgz"
tar czf ${TARFILE} package

echo "creating shasums"
shasum --algorithm 256 ${TARFILE} > ${TARFILE}.sha256sum
cat ${TARFILE}.sha256sum
#sha256sum ${TARFILE}
#rm -rf SHA256SUMS package

echo
echo "package.sh: DONE!"


