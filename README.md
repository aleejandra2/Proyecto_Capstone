1. **git status**          --> Ver cambios realizados
2. **git add .**           --> Preparar cambios
   
   **git add LevelUp/views.py** --> Para cambio en un archivo específico
4. **git commit -m "Mensaje"**  --> Crear commit
5. **git push**            --> Subir a GitHub a main
   
   **git push -u origin nombre_rama**  --> Subir a GitHub desde una rama




## Flujo recomendado para hacer cambios en una rama

1. Actualizar tu rama principal (main) antes de crear una rama nueva:

   - git checkout main
   - git pull


2. Crear y moverte a la nueva rama:

   - git checkout -b nombre_rama
     Ejemplo: feature/crear-vista-inicio

3. Hacer los cambios en los archivos de tu proyecto (editar código, agregar templates, static, etc.)
4. Verificar el estado de los cambios:
   
   - git status


5. Agregar los archivos al staging:

   - git add .


6. Hacer commit con un mensaje descriptivo:

   - git commit -m "Agregar vista de inicio y template index.html"


7. Subir la rama a GitHub (solo la primera vez con -u):

   - git push -u origin nombre_rama
      Para próximos cambios en la misma rama, basta con git push.

8. Cuando la rama esté lista para fusionar con main:

   - git checkout main      # cambiar a main
   - git pull               # actualizar main
   - git merge nombre_rama  # fusionar cambios
   - git push               # subir main actualizado


9. Borrar la rama si ya no se necesita (opcional):

   - git branch -d nombre_rama           # borrar rama local
   - git push origin --delete nombre_rama  # borrar rama remota


## Traer todo del main a la rama

1. Verifica en qué rama estás
- git status

1.1 Si no estás en tu rama, cámbiate a ella:

- git checkout tu-rama

2. Asegúrate de tener el main actualizado
- git fetch origin
- git checkout main
- git pull origin main

3. Vuelve a tu rama
- git checkout tu-rama

4. Trae los cambios del main a tu rama
- git merge main

5. Sube tu rama actualizada al remoto
- git push origin tu-rama


## Pasar todo de la rama al main

1. Primero asegúrate de tener todo listo en tu rama:
- git status

1.1 Si hay archivos modificados, confírmalos:
- git add .
- git commit -m "Mis últimos cambios en la rama"

2. Cambia a la rama main
- git checkout main

3. Actualiza el main desde el remoto
- git pull origin main

4. Une tu rama con el main

Tienes dos formas según lo que prefieras 👇

5. Merge (recomendada si estás trabajando con otros)
git merge tu-rama

6. Sube el main actualizado al remoto
git push origin main
