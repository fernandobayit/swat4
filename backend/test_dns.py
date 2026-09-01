from app.services.dns_tool import list_zones, list_records, add_record, delete_record
zones = list_zones()
print("Zones:", [z["name"] for z in zones])

if zones:
    test_zone = zones[0]["name"]
    print("Testing against zone:", test_zone)
    try:
        add_record(test_zone, "testrec1", "A", "10.0.0.5")
        print("Record 'testrec1' A 10.0.0.5 added.")
    except Exception as e:
        print("Add Error:", e)

    recs = list_records(test_zone)
    print("Found records matching 'testrec1':", [r for r in recs if r["name"] == "testrec1"])

    try:
        delete_record(test_zone, "testrec1", "A", "10.0.0.5")
        print("Record 'testrec1' deleted.")
    except Exception as e:
        print("Delete Error:", e)
