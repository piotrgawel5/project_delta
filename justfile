set shell := ["pwsh", "-c"]

dev:
    just api & just mobile

api:
    cd apps/api; npm run dev

mobile:
    cd apps/mobile; npx expo run:android

lint:
    npm run lint --workspaces

build:
    npm run build --workspaces

test:
    npm run test --workspaces
