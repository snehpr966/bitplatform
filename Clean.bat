FOR /F "tokens=*" %%G IN ('DIR /B /AD /S bin') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S obj') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S node_modules') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S Packages') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S .vs') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S TestResults') DO RMDIR /S /Q "%%G"
FOR /F "tokens=*" %%G IN ('DIR /B /AD /S AppPackages') DO RMDIR /S /Q "%%G"
DEL /Q /F /S "Resource.designer.cs"
DEL /Q /F /S "*.csproj.user"
DEL /Q /F /S "*.razor.css"
DEL /Q /F /S "*.razor.min.css"
DEL /Q /F /S "*.map"
powershell.exe "& Get-ChildItem -Recurse | Where-Object { $_.Attributes -match 'ReparsePoint' } | Remove-Item -Confirm:$false -Force -Recurse "