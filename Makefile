.PHONY: up down logs backup restore psql

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f app

backup:
	mkdir -p backups
	docker compose exec -T db pg_dump -U shitlist shitlist > backups/shitlist-$$(date +%Y%m%d-%H%M%S).sql

restore:
	@test -n "$(f)" || (echo "usage: make restore f=backups/shitlist-XXXX.sql"; exit 1)
	docker compose exec -T db psql -U shitlist -d shitlist -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker compose exec -T db psql -U shitlist -d shitlist < $(f)

psql:
	docker compose exec db psql -U shitlist shitlist