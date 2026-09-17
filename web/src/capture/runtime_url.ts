export function runtimeAssetUrl(path:string):URL{
  const capturePath=location.pathname.replace(/\/$/,'')==='/capture';
  const page=capturePath?new URL('../',location.href):new URL(location.href);
  return new URL(`${import.meta.env.BASE_URL}${path.replace(/^\//,'')}`,page);
}
